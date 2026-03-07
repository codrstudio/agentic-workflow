import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ReviewAgentType = "correctness" | "security" | "performance" | "standards";

interface ReviewAgent {
  type: ReviewAgentType;
  name: string;
  description: string;
  system_prompt: string;
  enabled: boolean;
}

export interface ReviewFinding {
  id: string;
  agent_type: ReviewAgentType;
  severity: "critical" | "warning" | "info";
  file_path: string;
  line_start?: number;
  line_end?: number;
  title: string;
  description: string;
  suggestion?: string;
  dismissed: boolean;
}

export interface AgentReviewResult {
  id: string;
  review_id: string;
  agent_type: ReviewAgentType;
  status: "pending" | "running" | "completed" | "failed";
  findings: ReviewFinding[];
  summary?: string;
  tokens_used: number;
  duration_ms: number;
  started_at?: string;
  completed_at?: string;
}

export type AgentReviewState = "idle" | "running" | "completed";

export function useReviewAgentsConfig(projectSlug: string) {
  return useQuery({
    queryKey: ["projects", projectSlug, "review-agents"],
    queryFn: async () => {
      const data = await apiFetch<{ agents: ReviewAgent[] }>(
        `/hub/projects/${projectSlug}/review-agents`
      );
      return data.agents;
    },
  });
}

export function useAgentReview(projectSlug: string, reviewId: string) {
  const queryClient = useQueryClient();
  const [agentResults, setAgentResults] = useState<AgentReviewResult[]>([]);
  const [state, setState] = useState<AgentReviewState>("idle");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load existing agent review results on mount
  useEffect(() => {
    apiFetch<{ agent_reviews?: AgentReviewResult[] }>(
      `/hub/projects/${projectSlug}/reviews/${reviewId}`
    )
      .then((review) => {
        const results = review.agent_reviews ?? [];
        setAgentResults(results);
        if (results.length > 0) {
          const hasRunning = results.some(
            (r) => r.status === "pending" || r.status === "running"
          );
          setState(hasRunning ? "running" : "completed");
        }
      })
      .catch(() => {
        // ignore
      });
  }, [projectSlug, reviewId]);

  const subscribeSSE = useCallback(
    (reviewId: string) => {
      const url = `/api/v1/hub/projects/${projectSlug}/reviews/${reviewId}/agent-review/stream`;
      const es = new EventSource(url);
      eventSourceRef.current = es;

      const handleEvent = (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data) as {
            type: string;
            agent_type: ReviewAgentType;
            data?: Record<string, unknown>;
          };

          setAgentResults((prev) => {
            const updated = [...prev];
            const idx = updated.findIndex(
              (r) => r.agent_type === event.agent_type
            );
            if (idx < 0) return prev;

            const result = { ...updated[idx]! };

            if (event.type === "agent:started") {
              result.status = "running";
              result.started_at = event.data?.started_at as string | undefined;
            } else if (event.type === "agent:completed") {
              result.status = "completed";
              result.summary = event.data?.summary as string | undefined;
              result.tokens_used = (event.data?.tokens_used as number) ?? 0;
              result.duration_ms = (event.data?.duration_ms as number) ?? 0;
            } else if (event.type === "agent:failed") {
              result.status = "failed";
            }

            updated[idx] = result;

            // Check if all done
            const allDone = updated.every(
              (r) => r.status === "completed" || r.status === "failed"
            );
            if (allDone) {
              setState("completed");
              es.close();
              eventSourceRef.current = null;
              // Invalidate to get full results
              queryClient.invalidateQueries({
                queryKey: ["projects", projectSlug, "reviews", reviewId],
              });
            }

            return updated;
          });
        } catch {
          // ignore parse errors
        }
      };

      es.addEventListener("agent:started", handleEvent);
      es.addEventListener("agent:completed", handleEvent);
      es.addEventListener("agent:failed", handleEvent);
      es.addEventListener("agent:finding", handleEvent);

      es.onerror = () => {
        es.close();
        eventSourceRef.current = null;
      };
    },
    [projectSlug, queryClient]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  const requestReview = useMutation({
    mutationFn: (agentTypes: ReviewAgentType[]) =>
      apiFetch<{ agent_reviews: AgentReviewResult[] }>(
        `/hub/projects/${projectSlug}/reviews/${reviewId}/agent-review`,
        {
          method: "POST",
          body: JSON.stringify({ agent_types: agentTypes }),
        }
      ),
    onSuccess: (data) => {
      setAgentResults(data.agent_reviews);
      setState("running");
      subscribeSSE(reviewId);
    },
  });

  const totalFindings = agentResults.reduce((sum, r) => {
    if (r.status === "completed") {
      return sum + (r.findings?.filter((f) => !f.dismissed).length ?? 0);
    }
    return sum;
  }, 0);

  const dismissFinding = useMutation({
    mutationFn: ({
      findingId,
      dismissed,
    }: {
      findingId: string;
      dismissed: boolean;
    }) =>
      apiFetch<{ id: string; dismissed: boolean }>(
        `/hub/projects/${projectSlug}/reviews/${reviewId}/findings/${findingId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ dismissed }),
        }
      ),
    onSuccess: (data) => {
      setAgentResults((prev) =>
        prev.map((r) => ({
          ...r,
          findings: r.findings.map((f) =>
            f.id === data.id ? { ...f, dismissed: data.dismissed } : f
          ),
        }))
      );
    },
  });

  return {
    state,
    agentResults,
    totalFindings,
    requestReview,
    dismissFinding,
    isRunning: state === "running",
  };
}

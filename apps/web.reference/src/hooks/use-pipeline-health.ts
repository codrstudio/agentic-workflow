import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ---- Types ----

export type StepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "circuit_broken";

export type StepHealth = "healthy" | "slow" | "failing" | "dead";

export type PipelineStatus =
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "stopped";

export interface PipelineStep {
  step_number: number;
  task: string;
  status: StepStatus;
  health: StepHealth;
  duration_seconds: number | null;
  retries: number;
  last_error: string | null;
}

export interface CircuitBreaker {
  triggered: boolean;
  trigger_reason: string | null;
  triggered_at: string | null;
  consecutive_failures: number;
  threshold: number;
}

export interface PipelineHealthStatus {
  project_id: string;
  wave: number;
  checked_at: string;
  status: PipelineStatus;
  steps: PipelineStep[];
  circuit_breaker: CircuitBreaker;
}

// ---- Query keys ----

export const pipelineHealthKeys = {
  all: ["pipeline-health"] as const,
  health: (projectId: string, wave?: number) =>
    ["pipeline-health", "status", projectId, wave] as const,
};

// ---- Hooks ----

export function usePipelineHealth(projectId: string, wave?: number) {
  return useQuery<PipelineHealthStatus>({
    queryKey: pipelineHealthKeys.health(projectId, wave),
    queryFn: () => {
      const qs = wave !== undefined ? `?wave=${wave}` : "";
      return apiFetch<PipelineHealthStatus>(
        `/hub/projects/${projectId}/pipeline/health${qs}`
      );
    },
    enabled: !!projectId,
    refetchInterval: 30_000,
  });
}

export function useResetCircuitBreaker(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean; message: string }>(
        `/hub/projects/${projectId}/pipeline/circuit-breaker/reset`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["pipeline-health", "status", projectId],
      });
    },
  });
}

/** Connect to SSE and invalidate health query on updates. */
export function usePipelineHealthSSE(projectId: string, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !projectId) return;

    const url = `/api/v1/hub/projects/${projectId}/pipeline/health/stream`;
    const es = new EventSource(url);

    const refresh = () => {
      queryClient.invalidateQueries({
        queryKey: ["pipeline-health", "status", projectId],
      });
    };

    es.addEventListener("pipeline:health-update", refresh);
    es.addEventListener("pipeline:cost-alert", refresh);

    return () => {
      es.close();
    };
  }, [projectId, enabled, queryClient]);
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { ReviewAgentType } from "@/hooks/use-agent-review";

export interface ReviewAgent {
  type: ReviewAgentType;
  name: string;
  description: string;
  system_prompt: string;
  enabled: boolean;
}

export function useReviewAgents(projectSlug: string) {
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

export function useReviewAgentDefaults(projectSlug: string) {
  return useQuery({
    queryKey: ["projects", projectSlug, "review-agents", "defaults"],
    queryFn: async () => {
      const data = await apiFetch<{ agents: ReviewAgent[] }>(
        `/hub/projects/${projectSlug}/review-agents/defaults`
      );
      return data.agents;
    },
  });
}

export function useUpdateReviewAgent(projectSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      type,
      updates,
    }: {
      type: ReviewAgentType;
      updates: { enabled?: boolean; system_prompt?: string };
    }) =>
      apiFetch<{ agent: ReviewAgent }>(
        `/hub/projects/${projectSlug}/review-agents/${type}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["projects", projectSlug, "review-agents"],
      });
    },
  });
}

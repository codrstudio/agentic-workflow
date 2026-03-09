import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface QualityFactors {
  first_pass_accepted: boolean;
  review_issues_count: number;
  rework_required: boolean;
  defects_introduced: number;
}

export interface AgentEvaluation {
  id: string;
  project_id: string;
  agent_profile: string;
  agent_model: string;
  task_type: string;
  wave_number: number;
  step_name: string;
  feature_id?: string;
  attempt_number: number;
  exit_code: number;
  success: boolean;
  duration_seconds: number;
  tokens_used: number;
  cost_usd: number;
  quality_score?: number;
  quality_factors?: QualityFactors;
  spawn_json_path?: string;
  created_at: string;
}

export interface AgentEvaluationListResponse {
  evaluations: AgentEvaluation[];
}

export const agentEvaluationKeys = {
  all: (slug: string) => ["agent-evaluations", slug] as const,
  list: (slug: string, filters?: Record<string, string>) =>
    [...agentEvaluationKeys.all(slug), "list", filters] as const,
  detail: (slug: string, id: string) =>
    [...agentEvaluationKeys.all(slug), "detail", id] as const,
};

export function useAgentEvaluations(
  slug: string,
  filters?: {
    agent_profile?: string;
    success?: string;
    from?: string;
    limit?: number;
    sort?: string;
  }
) {
  const params = new URLSearchParams();
  if (filters?.agent_profile) params.set("agent_profile", filters.agent_profile);
  if (filters?.success) params.set("success", filters.success);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.limit) params.set("limit", String(filters.limit));
  if (filters?.sort) params.set("sort", filters.sort);
  const qs = params.toString();

  return useQuery({
    queryKey: agentEvaluationKeys.list(slug, Object.fromEntries(params)),
    queryFn: () =>
      apiFetch<AgentEvaluationListResponse>(
        `/hub/projects/${slug}/evaluations${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useAgentEvaluation(slug: string, id: string) {
  return useQuery({
    queryKey: agentEvaluationKeys.detail(slug, id),
    queryFn: () =>
      apiFetch<AgentEvaluation>(
        `/hub/projects/${slug}/evaluations/${id}`
      ),
    enabled: !!id,
  });
}

export function useCreateAgentEvaluation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      agent_profile: string;
      agent_model: string;
      task_type: string;
      wave_number: number;
      step_name: string;
      feature_id?: string;
      attempt_number?: number;
      exit_code: number;
      success: boolean;
      duration_seconds: number;
      tokens_used?: number;
      cost_usd?: number;
      quality_score?: number;
      quality_factors?: QualityFactors;
      spawn_json_path?: string;
    }) =>
      apiFetch<AgentEvaluation>(
        `/hub/projects/${slug}/evaluations`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: agentEvaluationKeys.all(slug),
      });
    },
  });
}

export function usePatchAgentEvaluation(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      evaluationId,
      body,
    }: {
      evaluationId: string;
      body: {
        quality_score?: number;
        quality_factors?: QualityFactors;
      };
    }) =>
      apiFetch<AgentEvaluation>(
        `/hub/projects/${slug}/evaluations/${evaluationId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: agentEvaluationKeys.all(slug),
      });
    },
  });
}

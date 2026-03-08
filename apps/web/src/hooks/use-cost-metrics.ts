import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// --- Types matching server CostSummaryResponse ---

export interface CostSummaryResponse {
  project_id: string;
  period_from: string;
  period_to: string;
  computed_at: string;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  by_model: Record<
    string,
    { cost_usd: number; input_tokens: number; output_tokens: number }
  >;
  by_phase: Record<string, { cost_usd: number; total_tokens: number }>;
  by_feature: Array<{
    feature_id: string;
    cost_usd: number;
    total_tokens: number;
  }>;
  by_session: Array<{
    session_id: string;
    cost_usd: number;
    total_tokens: number;
  }>;
}

export interface ModelRecommendation {
  phase: string;
  recommended_model: string;
  rationale: string;
  cost_tier: string;
  quality_tier: string;
}

// --- Query keys ---

export const costKeys = {
  all: (slug: string) => ["cost", slug] as const,
  summary: (slug: string, from: string, to: string) =>
    [...costKeys.all(slug), "summary", from, to] as const,
  recommendations: (slug: string) =>
    [...costKeys.all(slug), "recommendations"] as const,
};

// --- Hooks ---

export function useCostSummary(
  projectSlug: string,
  from: string,
  to: string
) {
  return useQuery({
    queryKey: costKeys.summary(projectSlug, from, to),
    queryFn: () =>
      apiFetch<CostSummaryResponse>(
        `/hub/projects/${projectSlug}/cost-summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&top_features=10&top_sessions=5`
      ),
  });
}

export function useModelRecommendations(projectSlug: string) {
  return useQuery({
    queryKey: costKeys.recommendations(projectSlug),
    queryFn: () =>
      apiFetch<ModelRecommendation[]>(
        `/hub/projects/${projectSlug}/model-recommendations`
      ),
  });
}

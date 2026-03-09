import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ---- Types ----

export type DensityFreshness = "current" | "stale" | "outdated";
export type DensityRecommendationType = "split" | "merge" | "remove" | "update" | "summarize";

export interface DensityRecommendation {
  type: DensityRecommendationType;
  reason: string;
  target_source_id?: string;
}

export interface SourceDensityMetrics {
  source_id: string;
  project_id: string;
  token_count: number;
  information_density: number; // 0-100
  redundancy_score: number;    // 0-100
  relevance_score: number;     // 0-100
  freshness: DensityFreshness;
  usage_count: number;
  last_used_at: string | null;
  recommendations: DensityRecommendation[];
  computed_at: string;
}

export interface ContextQualityReport {
  project_id: string;
  profile_id: string | null;
  total_tokens: number;
  token_budget: number;
  budget_utilization: number; // %
  overall_density_score: number; // 0-100
  redundancy_percentage: number;
  low_relevance_percentage: number;
  top_recommendations: {
    priority: number;
    action: string;
    impact_tokens: number;
    affected_sources: string[];
  }[];
  computed_at: string;
}

// ---- Query keys ----

export const densityKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "context-density"] as const,
  list: (projectSlug: string, profileId?: string) =>
    [...densityKeys.all(projectSlug), "list", profileId ?? "all"] as const,
  quality: (projectSlug: string, profileId?: string) =>
    [...densityKeys.all(projectSlug), "quality", profileId ?? "all"] as const,
};

// ---- Hooks ----

export function useSourceDensity(projectSlug: string, profileId?: string) {
  return useQuery({
    queryKey: densityKeys.list(projectSlug, profileId),
    queryFn: () => {
      const params = profileId ? `?profile_id=${profileId}` : "";
      return apiFetch<SourceDensityMetrics[]>(
        `/hub/projects/${projectSlug}/context/density${params}`
      );
    },
  });
}

export function useContextQuality(projectSlug: string, profileId?: string) {
  return useQuery({
    queryKey: densityKeys.quality(projectSlug, profileId),
    queryFn: () => {
      const params = profileId ? `?profile_id=${profileId}` : "";
      return apiFetch<ContextQualityReport>(
        `/hub/projects/${projectSlug}/context/quality${params}`
      );
    },
  });
}

export function useAnalyzeDensity(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sourceIds?: string[]) =>
      apiFetch<SourceDensityMetrics[]>(
        `/hub/projects/${projectSlug}/context/density/analyze`,
        {
          method: "POST",
          body: JSON.stringify({ source_ids: sourceIds }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: densityKeys.all(projectSlug) });
    },
  });
}

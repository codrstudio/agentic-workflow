import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type OriginSource =
  | "ai_generated"
  | "ai_assisted"
  | "human_written"
  | "mixed";

export interface FeatureProductivityRecord {
  feature_id: string;
  project_id: string;
  origin: OriginSource;
  started_at?: string;
  completed_at?: string;
  total_duration_hours?: number;
  review_rounds: number;
  rework_count: number;
  defects_found: number;
  first_pass_accepted: boolean;
  ai_tokens_used: number;
  ai_cost_usd: number;
  created_at: string;
  updated_at: string;
}

export interface FeatureProductivityListResponse {
  records: FeatureProductivityRecord[];
}

export const featureProductivityKeys = {
  all: (slug: string) => ["feature-productivity", slug] as const,
  list: (slug: string, filters?: Record<string, string>) =>
    [...featureProductivityKeys.all(slug), "list", filters] as const,
  detail: (slug: string, featureId: string) =>
    [...featureProductivityKeys.all(slug), "detail", featureId] as const,
};

export function useFeatureProductivityRecords(
  slug: string,
  filters?: { origin?: string; first_pass?: string; limit?: number }
) {
  const params = new URLSearchParams();
  if (filters?.origin) params.set("origin", filters.origin);
  if (filters?.first_pass) params.set("first_pass", filters.first_pass);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: featureProductivityKeys.list(slug, Object.fromEntries(params)),
    queryFn: () =>
      apiFetch<FeatureProductivityListResponse>(
        `/hub/projects/${slug}/productivity/features${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useFeatureProductivityRecord(
  slug: string,
  featureId: string
) {
  return useQuery({
    queryKey: featureProductivityKeys.detail(slug, featureId),
    queryFn: () =>
      apiFetch<FeatureProductivityRecord>(
        `/hub/projects/${slug}/productivity/features/${featureId}`
      ),
    enabled: !!featureId,
  });
}

export function useCreateFeatureProductivity(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      featureId,
      body,
    }: {
      featureId: string;
      body: {
        origin: OriginSource;
        started_at?: string;
        completed_at?: string;
        total_duration_hours?: number;
        review_rounds?: number;
        rework_count?: number;
        defects_found?: number;
        first_pass_accepted?: boolean;
        ai_tokens_used?: number;
        ai_cost_usd?: number;
      };
    }) =>
      apiFetch<FeatureProductivityRecord>(
        `/hub/projects/${slug}/productivity/features/${featureId}`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureProductivityKeys.all(slug),
      });
    },
  });
}

export function usePatchFeatureProductivity(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      featureId,
      body,
    }: {
      featureId: string;
      body: {
        origin?: OriginSource;
        started_at?: string;
        completed_at?: string;
        total_duration_hours?: number;
        review_rounds?: number;
        rework_count?: number;
        defects_found?: number;
        first_pass_accepted?: boolean;
        ai_tokens_used?: number;
        ai_cost_usd?: number;
      };
    }) =>
      apiFetch<FeatureProductivityRecord>(
        `/hub/projects/${slug}/productivity/features/${featureId}`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: featureProductivityKeys.all(slug),
      });
    },
  });
}

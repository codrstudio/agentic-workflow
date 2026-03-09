import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface AIProductivitySnapshot {
  project_id: string;
  period_days: number;
  snapshot_date: string;
  total_features: number;
  ai_features: number;
  human_features: number;
  ai_rework_ratio: number;
  human_rework_ratio: number;
  first_pass_accuracy: number;
  defect_introduction_rate_ai: number;
  defect_introduction_rate_human: number;
  verification_tax_ratio: number;
  net_roi_hours: number;
  total_ai_cost_usd: number;
  total_generation_hours: number;
  total_review_hours: number;
  total_rework_hours: number;
  total_time_saved_hours: number;
  created_at: string;
}

export interface ProductivityHistoryEntry {
  week_start: string;
  snapshot: AIProductivitySnapshot;
}

export interface ProductivityHistoryResponse {
  history: ProductivityHistoryEntry[];
  from: string;
  to: string;
  granularity: string;
}

export const productivitySnapshotKeys = {
  all: (slug: string) => ["productivity-snapshot", slug] as const,
  snapshot: (slug: string, periodDays: number) =>
    [...productivitySnapshotKeys.all(slug), "snapshot", periodDays] as const,
  history: (slug: string, from?: string, to?: string) =>
    [...productivitySnapshotKeys.all(slug), "history", from, to] as const,
};

export function useProductivitySnapshot(slug: string, periodDays = 30) {
  return useQuery({
    queryKey: productivitySnapshotKeys.snapshot(slug, periodDays),
    queryFn: () =>
      apiFetch<AIProductivitySnapshot>(
        `/hub/projects/${slug}/productivity/snapshot?period_days=${periodDays}`
      ),
  });
}

export function useProductivityHistory(
  slug: string,
  from?: string,
  to?: string
) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  params.set("granularity", "weekly");
  const qs = params.toString();

  return useQuery({
    queryKey: productivitySnapshotKeys.history(slug, from, to),
    queryFn: () =>
      apiFetch<ProductivityHistoryResponse>(
        `/hub/projects/${slug}/productivity/history${qs ? `?${qs}` : ""}`
      ),
  });
}

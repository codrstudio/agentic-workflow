import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface ROIConfig {
  project_id: string;
  developer_hourly_rate_usd: number;
  baseline_hours_per_feature: number;
  updated_at: string;
}

export interface CoreROI {
  total_cost_usd: number;
  cost_per_feature_usd: number;
  features_completed: number;
  estimated_dev_hours_saved: number;
  estimated_dev_cost_saved_usd: number;
  roi_ratio: number;
}

export interface AIQuality {
  ai_rework_ratio: number;
  first_pass_accuracy: number;
  ai_vs_human_defect_rate: number | null;
}

export interface CostTrend {
  current_week: number;
  previous_week: number;
  change_pct: number;
}

export interface ByModelEntry {
  model: string;
  cost_usd: number;
  features: number;
  first_pass_rate: number;
  avg_cycle_time: number;
}

export interface AIROIMetrics {
  core_roi: CoreROI;
  ai_quality: AIQuality;
  cost_trend: CostTrend;
  by_model: ByModelEntry[];
  period_days: number;
  computed_at: string;
}

export interface ROISnapshot {
  id: string;
  project_id: string;
  date: string;
  roi_ratio: number;
  cost_per_feature_usd: number;
  first_pass_accuracy: number;
  rework_ratio: number;
  total_cost_usd: number;
  features_completed: number;
  created_at: string;
}

export interface SprintROI {
  sprint: number;
  roi_ratio: number;
  cost_per_feature: number;
  features: number;
  first_pass_rate: number;
  total_cost_usd: number;
}

// ----------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------

export function useROIMetrics(projectId: string, periodDays: number) {
  return useQuery<AIROIMetrics>({
    queryKey: ["roi-metrics", projectId, periodDays],
    queryFn: () =>
      apiFetch<AIROIMetrics>(
        `/hub/projects/${projectId}/roi/metrics?period_days=${periodDays}`
      ),
    staleTime: 10 * 60 * 1000, // 10 min (matches server cache)
    enabled: Boolean(projectId),
  });
}

export function useROISnapshots(
  projectId: string,
  from?: string,
  to?: string
) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString() ? `?${params.toString()}` : "";

  return useQuery<ROISnapshot[]>({
    queryKey: ["roi-snapshots", projectId, from, to],
    queryFn: () =>
      apiFetch<ROISnapshot[]>(`/hub/projects/${projectId}/roi/snapshots${qs}`),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(projectId),
  });
}

export function useROIBySprint(projectId: string) {
  return useQuery<SprintROI[]>({
    queryKey: ["roi-by-sprint", projectId],
    queryFn: () =>
      apiFetch<SprintROI[]>(`/hub/projects/${projectId}/roi/by-sprint`),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(projectId),
  });
}

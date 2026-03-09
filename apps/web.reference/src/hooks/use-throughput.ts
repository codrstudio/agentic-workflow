import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------

export interface FeatureCycleRecord {
  id: string;
  project_id: string;
  feature_id: string;
  sprint: number;
  started_at: string;
  completed_at: string | null;
  status: "in_progress" | "completed" | "failed" | "skipped";
  attempts: number;
  review_iterations: number;
  first_pass: boolean;
  ai_contribution: "none" | "partial" | "majority" | "full";
  cycle_time_hours: number | null;
  tags: string[];
}

export interface FeatureLevelMetrics {
  completed: number;
  in_progress: number;
  blocked: number;
  failed: number;
  avg_cycle_time_hours: number | null;
  first_pass_rate: number;
}

export interface DelegationRatio {
  none: number;
  partial: number;
  majority: number;
  full: number;
}

export interface AIEffectivenessMetrics {
  delegation_ratio: DelegationRatio;
  rework_ratio: number;
  human_intervention_rate: number;
}

export interface FeaturesPerWeekEntry {
  week: string;
  count: number;
}

export interface QualityMetrics {
  review_pass_rate: number;
  features_per_week: FeaturesPerWeekEntry[];
}

export interface ThroughputMetrics {
  feature_level: FeatureLevelMetrics;
  ai_effectiveness: AIEffectivenessMetrics;
  quality: QualityMetrics;
  period_days: number;
  computed_at: string;
}

export interface BottleneckEntry {
  phase: string;
  avg_duration_hours: number;
  failure_rate: number;
  features_affected: number;
}

export interface BottlenecksResponse {
  bottlenecks: BottleneckEntry[];
}

export interface DelegationDistribution {
  full_ai: number;
  majority_ai: number;
  partial_ai: number;
  human_driven: number;
}

export interface ReworkByDelegation {
  full_ai: number;
  majority_ai: number;
  partial_ai: number;
  human_driven: number;
}

export interface DelegationProfile {
  distribution: DelegationDistribution;
  rework_by_delegation: ReworkByDelegation;
  sweet_spot: string;
  sweet_spot_insight: string;
  total_features: number;
  period_days: number;
  computed_at: string;
}

export interface FeatureCyclesResponse {
  cycles: FeatureCycleRecord[];
}

// ----------------------------------------------------------------
// Query keys
// ----------------------------------------------------------------

export const throughputKeys = {
  all: (slug: string) => ["throughput", slug] as const,
  metrics: (slug: string, periodDays: number) =>
    [...throughputKeys.all(slug), "metrics", periodDays] as const,
  bottlenecks: (slug: string) =>
    [...throughputKeys.all(slug), "bottlenecks"] as const,
  delegation: (slug: string, periodDays: number) =>
    [...throughputKeys.all(slug), "delegation", periodDays] as const,
  cycles: (slug: string, filters?: Record<string, string>) =>
    [...throughputKeys.all(slug), "cycles", filters] as const,
};

// ----------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------

export function useThroughputMetrics(slug: string, periodDays = 30) {
  return useQuery({
    queryKey: throughputKeys.metrics(slug, periodDays),
    queryFn: () =>
      apiFetch<ThroughputMetrics>(
        `/hub/projects/${slug}/throughput/metrics?period_days=${periodDays}`
      ),
  });
}

export function useBottlenecks(slug: string) {
  return useQuery({
    queryKey: throughputKeys.bottlenecks(slug),
    queryFn: () =>
      apiFetch<BottlenecksResponse>(
        `/hub/projects/${slug}/throughput/bottlenecks`
      ),
  });
}

export function useDelegationProfile(slug: string, periodDays = 30) {
  return useQuery({
    queryKey: throughputKeys.delegation(slug, periodDays),
    queryFn: () =>
      apiFetch<DelegationProfile>(
        `/hub/projects/${slug}/throughput/delegation?period_days=${periodDays}`
      ),
  });
}

export function useFeatureCycles(
  slug: string,
  filters?: { sprint?: number; status?: string; ai_contribution?: string; limit?: number }
) {
  const params = new URLSearchParams();
  if (filters?.sprint) params.set("sprint", String(filters.sprint));
  if (filters?.status) params.set("status", filters.status);
  if (filters?.ai_contribution) params.set("ai_contribution", filters.ai_contribution);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: throughputKeys.cycles(slug, Object.fromEntries(params)),
    queryFn: () =>
      apiFetch<FeatureCyclesResponse>(
        `/hub/projects/${slug}/throughput/feature-cycles${qs ? `?${qs}` : ""}`
      ),
  });
}

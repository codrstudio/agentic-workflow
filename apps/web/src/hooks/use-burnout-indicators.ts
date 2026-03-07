import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface RiskFactor {
  factor: string;
  description: string;
  current_value: number;
  threshold: number;
  triggered: boolean;
}

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface BurnoutIndicators {
  project_id: string;
  computed_at: string;
  period_days: number;
  avg_session_duration_minutes: number;
  total_active_minutes_period: number;
  sessions_count_period: number;
  avg_messages_per_session: number;
  longest_streak_days: number;
  late_sessions_count: number;
  weekend_sessions_count: number;
  avg_context_switches_per_session: number;
  review_to_generation_ratio: number;
  verification_minutes_period: number;
  risk_level: RiskLevel;
  risk_factors: RiskFactor[];
}

export interface DailyActivitySummary {
  period_days: number;
  days: Array<Record<string, string | number>>;
}

export const burnoutKeys = {
  all: (slug: string) => ["burnout", slug] as const,
  indicators: (slug: string, period: number) =>
    [...burnoutKeys.all(slug), "indicators", period] as const,
  activitySummary: (slug: string, period: number) =>
    [...burnoutKeys.all(slug), "activity-summary", period] as const,
};

export function useBurnoutIndicators(projectSlug: string, periodDays = 7) {
  return useQuery({
    queryKey: burnoutKeys.indicators(projectSlug, periodDays),
    queryFn: () =>
      apiFetch<BurnoutIndicators>(
        `/hub/projects/${projectSlug}/burnout/indicators?period_days=${periodDays}`
      ),
  });
}

export function useActivitySummary(projectSlug: string, periodDays = 7) {
  return useQuery({
    queryKey: burnoutKeys.activitySummary(projectSlug, periodDays),
    queryFn: () =>
      apiFetch<DailyActivitySummary>(
        `/hub/projects/${projectSlug}/burnout/activity-summary?period_days=${periodDays}`
      ),
  });
}

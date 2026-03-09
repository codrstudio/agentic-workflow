import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PipelinePhase } from "./use-phase-autonomy";

export type TrustTrend = "rising" | "declining" | "stable";

export interface PhaseDelegationRate {
  phase: PipelinePhase;
  delegation_rate: number;
  total_events: number;
  auto_executed: number;
}

export interface TrustProgression {
  project_id: string;
  trust_score: number;
  delegation_rate: number;
  success_rate_auto: number;
  escalation_rate: number;
  trend: TrustTrend;
  previous_score: number | null;
  period_days: number;
  total_events: number;
  phase_delegation_rates: PhaseDelegationRate[];
  computed_at: string;
}

export const trustProgressionKeys = {
  all: (slug: string) => ["trust-progression", slug] as const,
  detail: (slug: string, periodDays?: number) =>
    [...trustProgressionKeys.all(slug), "detail", periodDays] as const,
};

export function useTrustProgression(slug: string, periodDays?: number) {
  const params = new URLSearchParams();
  if (periodDays) params.set("period_days", String(periodDays));
  const qs = params.toString();

  return useQuery({
    queryKey: trustProgressionKeys.detail(slug, periodDays),
    queryFn: () =>
      apiFetch<TrustProgression>(
        `/hub/projects/${slug}/autonomy/trust${qs ? `?${qs}` : ""}`
      ),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ShadowAiRisk = "low" | "moderate" | "high";

export type DecisionType =
  | "feature_approved"
  | "feature_rejected"
  | "review_completed"
  | "sign_off_granted"
  | "origin_reclassified"
  | "quality_gate_passed"
  | "quality_gate_failed"
  | "escalation_resolved";

export type ActorType = "human" | "system" | "agent";

export interface ComplianceSnapshot {
  project_id: string;
  computed_at: string;
  period_days: number;
  total_artifacts: number;
  artifacts_by_origin: {
    ai_generated: number;
    ai_assisted: number;
    human_written: number;
    mixed: number;
  };
  ai_ratio: number;
  total_decisions: number;
  human_oversight_events: number;
  oversight_ratio: number;
  features_total: number;
  features_with_review: number;
  features_with_sign_off: number;
  review_coverage: number;
  unreviewed_ai_artifacts: number;
  shadow_ai_risk: ShadowAiRisk;
}

export interface ComplianceDecisionLog {
  id: string;
  project_id: string;
  decision_type: DecisionType;
  actor: ActorType;
  target_type?: string;
  target_id?: string;
  details?: string;
  created_at: string;
}

export interface ComplianceDecisionsResponse {
  decisions: ComplianceDecisionLog[];
  total: number;
}

export const complianceKeys = {
  all: (slug: string) => ["compliance", slug] as const,
  snapshot: (slug: string, periodDays?: number) =>
    [...complianceKeys.all(slug), "snapshot", periodDays] as const,
  decisions: (slug: string, filters?: Record<string, string>) =>
    [...complianceKeys.all(slug), "decisions", filters] as const,
};

export function useComplianceSnapshot(slug: string, periodDays = 30) {
  return useQuery({
    queryKey: complianceKeys.snapshot(slug, periodDays),
    queryFn: () =>
      apiFetch<ComplianceSnapshot>(
        `/hub/projects/${slug}/compliance/snapshot?period_days=${periodDays}`
      ),
  });
}

export function useComplianceDecisions(
  slug: string,
  filters?: {
    actor?: string;
    decision_type?: string;
    from?: string;
    limit?: number;
  }
) {
  const params = new URLSearchParams();
  if (filters?.actor) params.set("actor", filters.actor);
  if (filters?.decision_type) params.set("decision_type", filters.decision_type);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: complianceKeys.decisions(slug, Object.fromEntries(params)),
    queryFn: () =>
      apiFetch<ComplianceDecisionsResponse>(
        `/hub/projects/${slug}/compliance/decisions${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useCreateComplianceDecision(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      decision_type: DecisionType;
      actor: ActorType;
      target_type?: string;
      target_id?: string;
      details?: string;
    }) =>
      apiFetch<ComplianceDecisionLog>(
        `/hub/projects/${slug}/compliance/decisions`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: complianceKeys.all(slug),
      });
    },
  });
}

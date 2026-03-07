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

export interface FeatureAttribution {
  feature_id: string;
  origin: "ai_generated" | "ai_assisted" | "human_written" | "mixed";
  human_oversight_count: number;
  has_human_edit: boolean;
  ai_models_used: string[];
}

export interface IPAttributionReport {
  project_id: string;
  generated_at: string;
  period: { from: string; to: string };
  total_code_artifacts: number;
  ai_generated_count: number;
  ai_assisted_count: number;
  human_written_count: number;
  mixed_count: number;
  human_oversight_actions: number;
  features_with_human_review: number;
  features_with_human_edit: number;
  feature_attributions: FeatureAttribution[];
  protectable_ratio: number;
  recommendation: string;
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

export function useCreateIpReport(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { from: string; to: string }) =>
      apiFetch<IPAttributionReport>(
        `/hub/projects/${slug}/compliance/ip-report`,
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

export interface ReviewSummary {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  items_count: number;
  approved_items: number;
  flagged_items: number;
  criteria_total: number;
  criteria_met: number;
}

export interface ComplianceExportBundle {
  export_metadata: {
    generated_at: string;
    project_id: string;
    period: { from: string; to: string };
    format: string;
    regulation: string;
  };
  compliance_snapshot: ComplianceSnapshot;
  decision_logs: ComplianceDecisionLog[];
  ip_report: IPAttributionReport;
  artifact_origins: unknown[];
  review_summaries: ReviewSummary[];
}

export function useComplianceExport(slug: string) {
  return useMutation({
    mutationFn: (params: { from?: string; to?: string; format?: string }) => {
      const qs = new URLSearchParams();
      if (params.from) qs.set("from", params.from);
      if (params.to) qs.set("to", params.to);
      if (params.format) qs.set("format", params.format);
      const query = qs.toString();
      return apiFetch<ComplianceExportBundle>(
        `/hub/projects/${slug}/compliance/export${query ? `?${query}` : ""}`
      );
    },
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

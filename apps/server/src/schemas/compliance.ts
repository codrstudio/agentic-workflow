import { z } from "zod";

export const ShadowAiRiskEnum = z.enum(["low", "moderate", "high"]);
export type ShadowAiRisk = z.infer<typeof ShadowAiRiskEnum>;

export const ComplianceSnapshotSchema = z.object({
  project_id: z.string(),
  computed_at: z.string().datetime(),
  period_days: z.number().int().positive(),
  total_artifacts: z.number().int().nonnegative(),
  artifacts_by_origin: z.object({
    ai_generated: z.number().int().nonnegative(),
    ai_assisted: z.number().int().nonnegative(),
    human_written: z.number().int().nonnegative(),
    mixed: z.number().int().nonnegative(),
  }),
  ai_ratio: z.number().min(0).max(1),
  total_decisions: z.number().int().nonnegative(),
  human_oversight_events: z.number().int().nonnegative(),
  oversight_ratio: z.number().min(0).max(1),
  features_total: z.number().int().nonnegative(),
  features_with_review: z.number().int().nonnegative(),
  features_with_sign_off: z.number().int().nonnegative(),
  review_coverage: z.number().min(0).max(1),
  unreviewed_ai_artifacts: z.number().int().nonnegative(),
  shadow_ai_risk: ShadowAiRiskEnum,
});

export type ComplianceSnapshot = z.infer<typeof ComplianceSnapshotSchema>;

export const DecisionTypeEnum = z.enum([
  "feature_approved",
  "feature_rejected",
  "review_completed",
  "sign_off_granted",
  "origin_reclassified",
  "quality_gate_passed",
  "quality_gate_failed",
  "escalation_resolved",
]);

export type DecisionType = z.infer<typeof DecisionTypeEnum>;

export const ActorTypeEnum = z.enum(["human", "system", "agent"]);
export type ActorType = z.infer<typeof ActorTypeEnum>;

export const ComplianceDecisionLogSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  decision_type: DecisionTypeEnum,
  actor: ActorTypeEnum,
  target_type: z.string().optional(),
  target_id: z.string().optional(),
  details: z.string().optional(),
  created_at: z.string().datetime(),
});

export type ComplianceDecisionLog = z.infer<typeof ComplianceDecisionLogSchema>;

export const CreateDecisionLogBody = z.object({
  decision_type: DecisionTypeEnum,
  actor: ActorTypeEnum,
  target_type: z.string().optional(),
  target_id: z.string().optional(),
  details: z.string().optional(),
});

export type CreateDecisionLogBody = z.infer<typeof CreateDecisionLogBody>;

// --- IP Attribution Report ---

export const FeatureAttributionSchema = z.object({
  feature_id: z.string(),
  origin: z.enum(["ai_generated", "ai_assisted", "human_written", "mixed"]),
  human_oversight_count: z.number().int().nonnegative(),
  has_human_edit: z.boolean(),
  ai_models_used: z.array(z.string()),
});

export type FeatureAttribution = z.infer<typeof FeatureAttributionSchema>;

export const IPAttributionReportSchema = z.object({
  project_id: z.string(),
  generated_at: z.string().datetime(),
  period: z.object({
    from: z.string(),
    to: z.string(),
  }),
  total_code_artifacts: z.number().int().nonnegative(),
  ai_generated_count: z.number().int().nonnegative(),
  ai_assisted_count: z.number().int().nonnegative(),
  human_written_count: z.number().int().nonnegative(),
  mixed_count: z.number().int().nonnegative(),
  human_oversight_actions: z.number().int().nonnegative(),
  features_with_human_review: z.number().int().nonnegative(),
  features_with_human_edit: z.number().int().nonnegative(),
  feature_attributions: z.array(FeatureAttributionSchema),
  protectable_ratio: z.number().min(0).max(1),
  recommendation: z.string(),
});

export type IPAttributionReport = z.infer<typeof IPAttributionReportSchema>;

export const CreateIpReportBody = z.object({
  from: z.string(),
  to: z.string(),
});

export type CreateIpReportBody = z.infer<typeof CreateIpReportBody>;

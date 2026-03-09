import { z } from "zod";

// ---- Attribution Enum ----

export const AttributionEnum = z.enum([
  "ai_full",
  "ai_majority",
  "ai_partial",
  "human",
]);

export type Attribution = z.infer<typeof AttributionEnum>;

// ---- FeatureVerificationRecord ----

export const FeatureVerificationRecordSchema = z.object({
  feature_id: z.string(),
  project_id: z.string().uuid(),
  sprint: z.number().int(),
  attribution: AttributionEnum,
  lines_generated: z.number().int().min(0),
  lines_reviewed: z.number().int().min(0),
  review_coverage: z.number().min(0).max(1), // lines_reviewed / lines_generated
  review_iterations: z.number().int().min(0),
  first_pass: z.boolean(),
  reworked: z.boolean(),
  rework_reason: z.string().nullable(),
  review_agents_used: z.array(z.string()),
  human_review_time_minutes: z.number().nullable(),
  verified_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
});

export type FeatureVerificationRecord = z.infer<
  typeof FeatureVerificationRecordSchema
>;

// ---- Create body ----

export const CreateVerificationRecordBodySchema = z.object({
  project_id: z.string().uuid(),
  sprint: z.number().int(),
  attribution: AttributionEnum,
  lines_generated: z.number().int().min(0),
  lines_reviewed: z.number().int().min(0),
  review_iterations: z.number().int().min(0).default(1),
  first_pass: z.boolean().default(true),
  reworked: z.boolean().default(false),
  rework_reason: z.string().nullable().default(null),
  review_agents_used: z.array(z.string()).default([]),
  human_review_time_minutes: z.number().nullable().default(null),
  verified_at: z.string().datetime().nullable().default(null),
});

export type CreateVerificationRecordBody = z.infer<
  typeof CreateVerificationRecordBodySchema
>;

// ---- Patch body ----

export const PatchVerificationRecordBodySchema = z.object({
  attribution: AttributionEnum.optional(),
  lines_generated: z.number().int().min(0).optional(),
  lines_reviewed: z.number().int().min(0).optional(),
  review_iterations: z.number().int().min(0).optional(),
  first_pass: z.boolean().optional(),
  reworked: z.boolean().optional(),
  rework_reason: z.string().nullable().optional(),
  review_agents_used: z.array(z.string()).optional(),
  human_review_time_minutes: z.number().nullable().optional(),
  verified_at: z.string().datetime().nullable().optional(),
});

export type PatchVerificationRecordBody = z.infer<
  typeof PatchVerificationRecordBodySchema
>;

// ---- VerificationDebtMetrics ----

export const DebtTrendEnum = z.enum(["improving", "stable", "worsening"]);
export type DebtTrend = z.infer<typeof DebtTrendEnum>;

export const VerificationDebtMetricsSchema = z.object({
  total_features_reviewed: z.number().int(),
  first_pass_acceptance_rate: z.number().min(0).max(100), // %
  rework_ratio: z.number().min(0).max(100), // %
  avg_review_iterations: z.number(),
  ai_generated_features: z.number().int(),
  human_generated_features: z.number().int(),
  ai_rework_rate: z.number().min(0).max(100), // %
  human_rework_rate: z.number().min(0).max(100), // %
  attribution_gap: z.number(), // ai_rework_rate - human_rework_rate
  unreviewed_count: z.number().int(),
  stale_review_count: z.number().int(),
  debt_score: z.number().min(0).max(100),
  debt_trend: DebtTrendEnum,
  features_per_week: z.number(),
  quality_score_per_week: z.number().min(0).max(100),
  velocity_quality_correlation: z.number().min(-1).max(1),
  computed_at: z.string().datetime(),
});

export type VerificationDebtMetrics = z.infer<
  typeof VerificationDebtMetricsSchema
>;

// ---- Debt history point ----

export const DebtHistoryPointSchema = z.object({
  date: z.string(), // ISO week start date YYYY-MM-DD
  debt_score: z.number().min(0).max(100),
  rework_ratio: z.number().min(0).max(100),
});

export type DebtHistoryPoint = z.infer<typeof DebtHistoryPointSchema>;

// ---- Cache ----

export const DebtMetricsCacheSchema = z.object({
  metrics: VerificationDebtMetricsSchema,
  cached_at: z.string().datetime(),
});

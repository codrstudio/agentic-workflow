import { z } from "zod";

export const ComprehensionGateTypeEnum = z.enum([
  "summary_required",
  "diff_review",
  "intent_confirmation",
  "scope_check",
]);

export type ComprehensionGateType = z.infer<typeof ComprehensionGateTypeEnum>;

export const AutoDetectedRiskEnum = z.enum(["low", "medium", "high"]);

export type AutoDetectedRisk = z.infer<typeof AutoDetectedRiskEnum>;

export const ComprehensionGateSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  session_id: z.string().uuid().nullable().default(null),
  phase: z.string(),
  type: ComprehensionGateTypeEnum,
  prompt: z.string(),
  response: z.string().nullable().default(null),
  cognitive_load_score: z.number().min(1).max(5).nullable().default(null),
  auto_detected_risk: AutoDetectedRiskEnum.default("low"),
  completed: z.boolean().default(false),
  bypassed: z.boolean().default(false),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().default(null),
});

export type ComprehensionGate = z.infer<typeof ComprehensionGateSchema>;

export const CreateGateBodySchema = z.object({
  session_id: z.string().uuid().nullable().optional(),
  phase: z.string().min(1),
  type: ComprehensionGateTypeEnum,
  prompt: z.string().min(1),
  auto_detected_risk: AutoDetectedRiskEnum.optional(),
});

export type CreateGateBody = z.infer<typeof CreateGateBodySchema>;

export const PatchGateBodySchema = z.object({
  response: z.string().optional(),
  cognitive_load_score: z.number().min(1).max(5).optional(),
  completed: z.boolean().optional(),
  bypassed: z.boolean().optional(),
  completed_at: z.string().datetime().optional(),
});

export type PatchGateBody = z.infer<typeof PatchGateBodySchema>;

export const CognitiveDebtIndicatorSchema = z.object({
  project_id: z.string(),
  computed_at: z.string().datetime(),
  period: z.object({ from: z.string(), to: z.string() }),
  total_gates: z.number().int(),
  completed_gates: z.number().int(),
  bypassed_gates: z.number().int(),
  completion_rate: z.number(),
  avg_cognitive_load: z.number().nullable(),
  high_risk_phases: z.array(z.string()),
  generation_rate_lines_per_min: z.number(),
  review_rate_lines_per_min: z.number(),
  comprehension_gap_ratio: z.number(),
});

export type CognitiveDebtIndicator = z.infer<typeof CognitiveDebtIndicatorSchema>;

export const IndicatorsCacheSchema = z.object({
  cached_at: z.string().datetime(),
  ttl_minutes: z.number().int(),
  data: CognitiveDebtIndicatorSchema,
});

export type IndicatorsCache = z.infer<typeof IndicatorsCacheSchema>;

export const DetectRiskBodySchema = z.object({
  phase: z.string().min(1),
  artifacts_changed: z.number().int().min(0),
  lines_generated: z.number().int().min(0),
});

export type DetectRiskBody = z.infer<typeof DetectRiskBodySchema>;

export const DetectRiskResponseSchema = z.object({
  risk_level: AutoDetectedRiskEnum,
  gate_type: ComprehensionGateTypeEnum,
  prompt: z.string(),
});

export type DetectRiskResponse = z.infer<typeof DetectRiskResponseSchema>;

import { z } from "zod";

// ---- MaturityStage ----

export const MaturityStageEnum = z.enum([
  "vibe",
  "structured",
  "architected",
  "reviewed",
  "production",
]);

export type MaturityStageValue = z.infer<typeof MaturityStageEnum>;

export const StageHistoryEntrySchema = z.object({
  stage: MaturityStageEnum,
  entered_at: z.string().datetime(),
  gate_passed: z.boolean(),
  gate_results: z.record(z.string(), z.unknown()),
});

export type StageHistoryEntry = z.infer<typeof StageHistoryEntrySchema>;

export const MaturityStageSchema = z.object({
  project_id: z.string().uuid(),
  current_stage: MaturityStageEnum,
  stage_history: z.array(StageHistoryEntrySchema),
  updated_at: z.string().datetime(),
});

export type MaturityStage = z.infer<typeof MaturityStageSchema>;

// ---- ProductionGate ----

export const GateCheckTypeEnum = z.enum(["automatic", "manual"]);
export const GateCheckStatusEnum = z.enum([
  "pending",
  "passed",
  "failed",
  "skipped",
]);
export const GateOverallStatusEnum = z.enum(["pending", "passed", "failed"]);

export const GateCheckSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  description: z.string(),
  type: GateCheckTypeEnum,
  status: GateCheckStatusEnum,
  details: z.string().nullable(),
  checked_at: z.string().datetime().nullable(),
});

export type GateCheck = z.infer<typeof GateCheckSchema>;

export const ProductionGateSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  from_stage: MaturityStageEnum,
  to_stage: MaturityStageEnum,
  checks: z.array(GateCheckSchema),
  overall_status: GateOverallStatusEnum,
  blocking: z.boolean(),
  created_at: z.string().datetime(),
  resolved_at: z.string().datetime().nullable(),
});

export type ProductionGate = z.infer<typeof ProductionGateSchema>;

// ---- Request bodies ----

export const EvaluateGateBodySchema = z.object({
  from_stage: MaturityStageEnum,
  to_stage: MaturityStageEnum,
});

export const PatchCheckBodySchema = z.object({
  status: z.enum(["passed", "failed", "skipped"]),
  details: z.string().nullable().optional(),
});

// ---- Advance Stage ----

export const AdvanceStageBodySchema = z.object({
  to_stage: MaturityStageEnum,
});

// ---- Production Readiness Checklist ----

export const ReadinessItemStatusEnum = z.enum([
  "met",
  "not_met",
  "partial",
  "not_applicable",
]);

export type ReadinessItemStatus = z.infer<typeof ReadinessItemStatusEnum>;

export const ReadinessItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  status: ReadinessItemStatusEnum,
  evidence: z.string().nullable(),
});

export type ReadinessItem = z.infer<typeof ReadinessItemSchema>;

export const ReadinessCategorySchema = z.object({
  name: z.enum([
    "Security",
    "Performance",
    "Observability",
    "Reliability",
    "Data",
  ]),
  items: z.array(ReadinessItemSchema),
  completion_rate: z.number().min(0).max(100),
});

export type ReadinessCategory = z.infer<typeof ReadinessCategorySchema>;

export const ProductionReadinessChecklistSchema = z.object({
  project_id: z.string().uuid(),
  categories: z.array(ReadinessCategorySchema),
  overall_readiness: z.number().min(0).max(100),
  blockers: z.array(ReadinessItemSchema),
  computed_at: z.string().datetime(),
});

export type ProductionReadinessChecklist = z.infer<
  typeof ProductionReadinessChecklistSchema
>;

export const ReadinessCacheSchema = z.object({
  checklist: ProductionReadinessChecklistSchema,
  cached_at: z.string().datetime(),
  ttl_minutes: z.number(),
});

export type ReadinessCache = z.infer<typeof ReadinessCacheSchema>;

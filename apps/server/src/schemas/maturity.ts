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
  gate_results: z.record(z.unknown()),
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

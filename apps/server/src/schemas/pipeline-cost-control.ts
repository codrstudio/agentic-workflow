import { z } from "zod";

export const CostHistoryEntrySchema = z.object({
  wave: z.number().int(),
  step: z.number().int(),
  task: z.string(),
  tokens_input: z.number().int(),
  tokens_output: z.number().int(),
  cost_usd: z.number(),
  timestamp: z.string().datetime(),
});

export type CostHistoryEntry = z.infer<typeof CostHistoryEntrySchema>;

export const CostControlSchema = z.object({
  project_id: z.string().uuid(),
  budget_limit_usd: z.number().nullable(),
  current_spend_usd: z.number().default(0),
  alert_threshold_percent: z.number().int().min(1).max(100).default(80),
  per_wave_limit_usd: z.number().nullable(),
  per_step_limit_usd: z.number().nullable(),
  cost_history: z.array(CostHistoryEntrySchema),
  updated_at: z.string().datetime(),
});

export type CostControl = z.infer<typeof CostControlSchema>;

export const UpdateCostControlSchema = z.object({
  budget_limit_usd: z.number().nullable().optional(),
  alert_threshold_percent: z.number().int().min(1).max(100).optional(),
  per_wave_limit_usd: z.number().nullable().optional(),
  per_step_limit_usd: z.number().nullable().optional(),
});

export type UpdateCostControl = z.infer<typeof UpdateCostControlSchema>;

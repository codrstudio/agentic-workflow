import { z } from "zod";
import { PipelinePhaseEnum } from "./phase-autonomy.js";

export const TrustTrendEnum = z.enum(["rising", "declining", "stable"]);

export type TrustTrend = z.infer<typeof TrustTrendEnum>;

export const PhaseDelegationRateSchema = z.object({
  phase: PipelinePhaseEnum,
  delegation_rate: z.number().min(0).max(1),
  total_events: z.number().int().min(0),
  auto_executed: z.number().int().min(0),
});

export type PhaseDelegationRate = z.infer<typeof PhaseDelegationRateSchema>;

export const TrustProgressionSchema = z.object({
  project_id: z.string(),
  trust_score: z.number().min(0).max(100),
  delegation_rate: z.number().min(0).max(1),
  success_rate_auto: z.number().min(0).max(1),
  escalation_rate: z.number().min(0).max(1),
  trend: TrustTrendEnum,
  previous_score: z.number().min(0).max(100).nullable(),
  period_days: z.number().int().positive(),
  total_events: z.number().int().min(0),
  phase_delegation_rates: z.array(PhaseDelegationRateSchema),
  computed_at: z.string().datetime(),
});

export type TrustProgression = z.infer<typeof TrustProgressionSchema>;

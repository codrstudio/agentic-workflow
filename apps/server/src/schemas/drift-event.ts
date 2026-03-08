import { z } from "zod";

export const DriftTypeEnum = z.enum([
  "path_violation",
  "tool_violation",
  "timeout_warning",
  "output_exceeded",
  "off_topic",
]);
export type DriftType = z.infer<typeof DriftTypeEnum>;

export const ActionTakenEnum = z.enum(["logged", "warned", "intervened", "killed"]);
export type ActionTaken = z.infer<typeof ActionTakenEnum>;

export const DriftEventSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  policy_id: z.string().uuid(),
  policy_name: z.string().min(1),
  drift_type: DriftTypeEnum,
  description: z.string().min(1),
  step: z.string().nullable().default(null),
  agent: z.string().nullable().default(null),
  action_taken: ActionTakenEnum,
  detected_at: z.string().datetime(),
});

export type DriftEvent = z.infer<typeof DriftEventSchema>;

export const CreateDriftEventBody = z.object({
  policy_id: z.string().uuid(),
  policy_name: z.string().min(1),
  drift_type: DriftTypeEnum,
  description: z.string().min(1),
  step: z.string().nullable().optional(),
  agent: z.string().nullable().optional(),
  action_taken: ActionTakenEnum,
  detected_at: z.string().datetime().optional(),
});

export type CreateDriftEventBody = z.infer<typeof CreateDriftEventBody>;

export const ContainmentSummarySchema = z.object({
  total_spawns: z.number().int().nonnegative(),
  spawns_with_drift: z.number().int().nonnegative(),
  drift_rate: z.number().min(0).max(1),
  drift_by_type: z.record(DriftTypeEnum, z.number().int().nonnegative()),
  policies_active: z.number().int().nonnegative(),
  most_violated_policy: z.string().nullable(),
  interventions: z.number().int().nonnegative(),
  period_days: z.number().int().positive(),
});

export type ContainmentSummary = z.infer<typeof ContainmentSummarySchema>;

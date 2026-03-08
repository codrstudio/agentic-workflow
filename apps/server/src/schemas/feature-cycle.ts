import { z } from "zod";

export const CycleStatusEnum = z.enum([
  "in_progress",
  "completed",
  "failed",
  "skipped",
]);
export type CycleStatus = z.infer<typeof CycleStatusEnum>;

export const AIContributionEnum = z.enum([
  "none",
  "partial",
  "majority",
  "full",
]);
export type AIContribution = z.infer<typeof AIContributionEnum>;

export const FeatureCycleRecordSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  feature_id: z.string().regex(/^F-\d+$/),
  sprint: z.number().int().positive(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().default(null),
  status: CycleStatusEnum.default("in_progress"),
  attempts: z.number().int().positive().default(1),
  review_iterations: z.number().int().min(0).default(0),
  first_pass: z.boolean(),
  ai_contribution: AIContributionEnum,
  cycle_time_hours: z.number().nullable().default(null),
  tags: z.array(z.string()).default([]),
});

export type FeatureCycleRecord = z.infer<typeof FeatureCycleRecordSchema>;

export const CreateFeatureCycleBody = FeatureCycleRecordSchema.omit({
  id: true,
  project_id: true,
  started_at: true,
  completed_at: true,
  first_pass: true,
  cycle_time_hours: true,
}).extend({
  started_at: z.string().datetime().optional(),
  attempts: z.number().int().positive().default(1),
  review_iterations: z.number().int().min(0).default(0),
  tags: z.array(z.string()).default([]),
});

export const PatchFeatureCycleBody = FeatureCycleRecordSchema.omit({
  id: true,
  project_id: true,
  feature_id: true,
  sprint: true,
  started_at: true,
  first_pass: true,
  cycle_time_hours: true,
}).partial();

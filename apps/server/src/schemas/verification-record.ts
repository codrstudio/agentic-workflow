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

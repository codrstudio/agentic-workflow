import { z } from "zod";

export const HandoffSourceTypeEnum = z.enum([
  "chat_session",
  "artifact",
  "source_file",
  "free_text",
]);

export const HandoffStatusEnum = z.enum([
  "draft",
  "generating_spec",
  "spec_ready",
  "generating_prp",
  "prp_ready",
  "enqueued",
  "cancelled",
]);

export const HandoffRequestSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  title: z.string().min(3),
  source_type: HandoffSourceTypeEnum,
  source_ref: z.string().nullable().optional(),
  description: z.string().min(10),
  status: HandoffStatusEnum.default("draft"),
  generated_spec_id: z.string().uuid().nullable().optional(),
  generated_prp_id: z.string().uuid().nullable().optional(),
  feature_id: z.string().nullable().optional(),
  spec_approved: z.boolean().default(false),
  prp_approved: z.boolean().default(false),
  pm_notes: z.string().nullable().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateHandoffRequestBody = z.object({
  title: z.string().min(3),
  source_type: HandoffSourceTypeEnum,
  source_ref: z.string().nullable().optional(),
  description: z.string().min(10),
  pm_notes: z.string().nullable().optional(),
});

export const PatchHandoffRequestBody = z.object({
  title: z.string().min(3).optional(),
  description: z.string().min(10).optional(),
  pm_notes: z.string().nullable().optional(),
  spec_approved: z.boolean().optional(),
  prp_approved: z.boolean().optional(),
  status: HandoffStatusEnum.optional(),
  generated_spec_id: z.string().uuid().nullable().optional(),
  generated_prp_id: z.string().uuid().nullable().optional(),
  feature_id: z.string().nullable().optional(),
  source_ref: z.string().nullable().optional(),
});

export const HandoffTemplateSchema = z.object({
  project_id: z.string(),
  spec_prompt_template: z.string(),
  prp_prompt_template: z.string(),
  default_sprint: z.number().int().positive().optional(),
  updated_at: z.string().datetime(),
});

export const PatchHandoffTemplateBody = z.object({
  spec_prompt_template: z.string().optional(),
  prp_prompt_template: z.string().optional(),
  default_sprint: z.number().int().positive().nullable().optional(),
});

export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;
export type HandoffTemplate = z.infer<typeof HandoffTemplateSchema>;
export type CreateHandoffRequestBodyType = z.infer<typeof CreateHandoffRequestBody>;
export type PatchHandoffRequestBodyType = z.infer<typeof PatchHandoffRequestBody>;

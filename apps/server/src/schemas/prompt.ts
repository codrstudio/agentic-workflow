import { z } from "zod";

export const PromptCategoryEnum = z.enum([
  "system",
  "task",
  "review",
  "generation",
  "analysis",
  "custom",
]);

export type PromptCategory = z.infer<typeof PromptCategoryEnum>;

export const PromptVariableSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  default_value: z.string().optional(),
  required: z.boolean().default(true),
});

export const PromptArtifactSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: PromptCategoryEnum,
  content: z.string(),
  variables: z.array(PromptVariableSchema).default([]),
  tags: z.array(z.string()).default([]),
  version: z.number().int().min(1),
  is_template: z.boolean().default(false),
  is_deleted: z.boolean().default(false),
  parent_id: z.string().uuid().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type PromptArtifact = z.infer<typeof PromptArtifactSchema>;

export const CreatePromptBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: PromptCategoryEnum,
  content: z.string(),
  variables: z.array(PromptVariableSchema).default([]),
  tags: z.array(z.string()).default([]),
  is_template: z.boolean().default(false),
  parent_id: z.string().uuid().optional(),
});

export type CreatePromptBody = z.infer<typeof CreatePromptBody>;

export const PatchPromptBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  category: PromptCategoryEnum.optional(),
  content: z.string().optional(),
  variables: z.array(PromptVariableSchema).optional(),
  tags: z.array(z.string()).optional(),
  is_template: z.boolean().optional(),
  change_note: z.string().optional(),
});

export type PatchPromptBody = z.infer<typeof PatchPromptBody>;

export const PromptVersionSchema = z.object({
  prompt_id: z.string().uuid(),
  version: z.number().int().min(1),
  content: z.string(),
  variables: z.array(PromptVariableSchema),
  change_note: z.string().optional(),
  created_at: z.string().datetime(),
});

export type PromptVersion = z.infer<typeof PromptVersionSchema>;

export const RenderPromptBody = z.object({
  variables: z.record(z.string(), z.string()),
});

export type RenderPromptBody = z.infer<typeof RenderPromptBody>;

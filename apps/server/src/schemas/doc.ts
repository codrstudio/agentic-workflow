import { z } from "zod";

export const DocTypeEnum = z.enum([
  "api_reference",
  "component_guide",
  "architecture",
  "user_guide",
  "changelog",
  "runbook",
  "custom",
]);

export type DocType = z.infer<typeof DocTypeEnum>;

export const DocStatusEnum = z.enum([
  "draft",
  "in_review",
  "verified",
  "outdated",
  "rejected",
]);

export type DocStatus = z.infer<typeof DocStatusEnum>;

export const DocSourceRefSchema = z.object({
  type: z.enum(["spec", "prp", "feature", "source", "code_file"]),
  id: z.string(),
  name: z.string(),
});

export type DocSourceRef = z.infer<typeof DocSourceRefSchema>;

export const DocArtifactSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  title: z.string(),
  doc_type: DocTypeEnum,
  status: DocStatusEnum,
  content: z.string(),
  generated_from: z.array(DocSourceRefSchema).default([]),
  generation_prompt: z.string().optional(),
  ai_model: z.string().optional(),
  tokens_used: z.number().int().optional(),
  version: z.number().int().min(1),
  verified_by: z.string().optional(),
  verified_at: z.string().datetime().optional(),
  verification_notes: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type DocArtifact = z.infer<typeof DocArtifactSchema>;

export const GenerateDocBody = z.object({
  doc_type: DocTypeEnum,
  title: z.string().min(1).max(300),
  source_ids: z.array(z.string()).min(1),
  custom_prompt: z.string().optional(),
});

export type GenerateDocBody = z.infer<typeof GenerateDocBody>;

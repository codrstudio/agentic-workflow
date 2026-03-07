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

// --- F-117: CRUD + versioning + verification ---

export const PatchDocBody = z.object({
  title: z.string().min(1).max(300).optional(),
  content: z.string().optional(),
  status: DocStatusEnum.optional(),
  doc_type: DocTypeEnum.optional(),
});

export type PatchDocBody = z.infer<typeof PatchDocBody>;

export const VerifyDocBody = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
  verified_by: z.string().default("user"),
});

export type VerifyDocBody = z.infer<typeof VerifyDocBody>;

export const DocVerificationActionEnum = z.enum([
  "comment",
  "suggest_edit",
  "approve",
  "reject",
]);

export type DocVerificationAction = z.infer<typeof DocVerificationActionEnum>;

export const LineRangeSchema = z.object({
  start: z.number().int().min(1),
  end: z.number().int().min(1),
});

export type LineRange = z.infer<typeof LineRangeSchema>;

export const DocVerificationCommentSchema = z.object({
  id: z.string().uuid(),
  doc_id: z.string().uuid(),
  author: z.string(),
  content: z.string().min(1),
  line_range: LineRangeSchema.optional(),
  action: DocVerificationActionEnum,
  created_at: z.string().datetime(),
});

export type DocVerificationComment = z.infer<typeof DocVerificationCommentSchema>;

export const CreateCommentBody = z.object({
  author: z.string().default("user"),
  content: z.string().min(1),
  line_range: LineRangeSchema.optional(),
  action: DocVerificationActionEnum.default("comment"),
});

export type CreateCommentBody = z.infer<typeof CreateCommentBody>;

export const DocVersionSchema = z.object({
  doc_id: z.string().uuid(),
  version: z.number().int().min(1),
  content: z.string(),
  title: z.string(),
  status: DocStatusEnum,
  created_at: z.string().datetime(),
});

export type DocVersion = z.infer<typeof DocVersionSchema>;

import { z } from "zod";

export const ArtifactTypeEnum = z.enum([
  "document",
  "code",
  "json",
  "diagram",
  "config",
]);

export const ArtifactOriginEnum = z.enum(["chat", "harness", "manual"]);

export const ArtifactSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: ArtifactTypeEnum,
  origin: ArtifactOriginEnum,
  content: z.string().optional(),
  file_path: z.string().optional(),
  session_id: z.string().uuid().optional(),
  step_ref: z.string().optional(),
  version: z.number().int().min(1).default(1),
  tags: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Artifact = z.infer<typeof ArtifactSchema>;

export const CreateArtifactBody = z.object({
  name: z.string().min(1).max(200),
  type: ArtifactTypeEnum,
  origin: ArtifactOriginEnum.default("manual"),
  content: z.string().min(1),
  session_id: z.string().uuid().optional(),
  step_ref: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateArtifactBody = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

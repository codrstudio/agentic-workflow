import { z } from "zod";

export const OriginSourceEnum = z.enum([
  "ai_generated",
  "ai_assisted",
  "human_written",
  "mixed",
]);

export type OriginSource = z.infer<typeof OriginSourceEnum>;

export const ArtifactTypeEnum = z.enum([
  "source",
  "artifact",
  "review",
  "session_message",
  "feature_code",
]);

export const TaggedByEnum = z.enum(["system", "user"]);

export const ArtifactOriginSchema = z.object({
  artifact_id: z.string().uuid(),
  artifact_type: ArtifactTypeEnum,
  origin: OriginSourceEnum,
  agent_model: z.string().optional(),
  session_id: z.string().uuid().optional(),
  tagged_at: z.string().datetime(),
  tagged_by: TaggedByEnum,
});

export type ArtifactOrigin = z.infer<typeof ArtifactOriginSchema>;

export const CreateOriginBody = z.object({
  artifact_id: z.string().uuid(),
  artifact_type: ArtifactTypeEnum,
  origin: OriginSourceEnum.optional(),
  agent_model: z.string().optional(),
  session_id: z.string().uuid().optional(),
  tagged_by: TaggedByEnum.default("system"),
  context: z
    .enum(["chat", "manual", "harness", "edit_after_ai"])
    .optional(),
});

export type CreateOriginBody = z.infer<typeof CreateOriginBody>;

export const PatchOriginBody = z.object({
  origin: OriginSourceEnum,
  tagged_by: TaggedByEnum.default("user"),
  reason: z.string().optional(),
});

export type PatchOriginBody = z.infer<typeof PatchOriginBody>;

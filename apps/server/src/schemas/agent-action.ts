import { z } from "zod";

export const AgentActionTypeEnum = z.enum([
  "feature_spawn",
  "review_spawn",
  "merge_spawn",
  "pipeline_phase",
  "automation",
  "chat_session",
]);

export const AgentActionStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "pending_approval",
  "approved",
  "rejected",
  "skipped",
]);

export const AgentActionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  action_type: AgentActionTypeEnum,
  status: AgentActionStatusEnum,
  agent_profile: z.string().optional(),
  task_name: z.string().optional(),
  feature_id: z.string().nullable().optional(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().optional(),
  duration_ms: z.number().int().nonnegative().nullable().optional(),
  exit_code: z.number().int().nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  output_preview: z.string().max(500).nullable().optional(),
  requires_approval: z.boolean().default(false),
  approval_reason: z.string().nullable().optional(),
  approved_by: z.literal("user").nullable().optional(),
  approval_note: z.string().nullable().optional(),
  approved_at: z.string().datetime().nullable().optional(),
  spawn_dir: z.string().nullable().optional(),
});

export const CreateAgentActionBody = z.object({
  action_type: AgentActionTypeEnum,
  agent_profile: z.string().optional(),
  task_name: z.string().optional(),
  feature_id: z.string().nullable().optional(),
  started_at: z.string().datetime().optional(),
  summary: z.string().max(500).nullable().optional(),
  output_preview: z.string().nullable().optional(),
  requires_approval: z.boolean().default(false),
  approval_reason: z.string().nullable().optional(),
  spawn_dir: z.string().nullable().optional(),
});

export const PatchAgentActionBody = z.object({
  status: AgentActionStatusEnum.optional(),
  completed_at: z.string().datetime().nullable().optional(),
  duration_ms: z.number().int().nonnegative().nullable().optional(),
  exit_code: z.number().int().nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  output_preview: z.string().nullable().optional(),
});

export type AgentAction = z.infer<typeof AgentActionSchema>;
export type CreateAgentActionBodyType = z.infer<typeof CreateAgentActionBody>;
export type PatchAgentActionBodyType = z.infer<typeof PatchAgentActionBody>;

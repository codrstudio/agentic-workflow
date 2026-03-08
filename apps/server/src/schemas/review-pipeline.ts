import { z } from "zod";

export const AgentTypeEnum = z.enum([
  "security",
  "quality",
  "spec_compliance",
  "architecture",
]);
export type AgentType = z.infer<typeof AgentTypeEnum>;

export const AgentConfigSchema = z.object({
  type: AgentTypeEnum,
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1),
});
export type AgentConfig = z.infer<typeof AgentConfigSchema>;

export const FindingSeverityEnum = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "info",
]);
export type FindingSeverity = z.infer<typeof FindingSeverityEnum>;

export const FindingSchema = z.object({
  severity: FindingSeverityEnum,
  file: z.string(),
  line: z.number().int().nullable().default(null),
  message: z.string(),
  suggestion: z.string().nullable().default(null),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AgentResultStatusEnum = z.enum(["pass", "fail", "warning"]);

export const AgentResultSchema = z.object({
  agent_type: AgentTypeEnum,
  status: AgentResultStatusEnum,
  findings_count: z.number().int().default(0),
  critical_findings: z.number().int().default(0),
  summary: z.string(),
  findings: z.array(FindingSchema).default([]),
  duration_seconds: z.number().default(0),
});
export type AgentResult = z.infer<typeof AgentResultSchema>;

export const ReviewPipelineTriggerEnum = z.enum(["automatic", "manual"]);
export const ReviewPipelineStatusEnum = z.enum([
  "queued",
  "running",
  "completed",
  "failed",
]);
export const ReviewPipelineVerdictEnum = z.enum([
  "pass",
  "fail",
  "needs_human_review",
]);

export const ReviewPipelineSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  feature_id: z.string().nullable().default(null),
  trigger: ReviewPipelineTriggerEnum,
  status: ReviewPipelineStatusEnum.default("queued"),
  agents_config: z.array(AgentConfigSchema).default([]),
  results: z.array(AgentResultSchema).default([]),
  overall_verdict: ReviewPipelineVerdictEnum.nullable().default(null),
  human_review_required: z.boolean().default(false),
  human_review_reason: z.string().nullable().default(null),
  started_at: z.string().datetime().nullable().default(null),
  completed_at: z.string().datetime().nullable().default(null),
  created_at: z.string().datetime(),
});
export type ReviewPipeline = z.infer<typeof ReviewPipelineSchema>;

export const CreateReviewPipelineBodySchema = z.object({
  feature_id: z.string().nullable().optional(),
  agents_config: z.array(AgentConfigSchema).optional(),
  trigger: ReviewPipelineTriggerEnum.optional().default("manual"),
});
export type CreateReviewPipelineBody = z.infer<
  typeof CreateReviewPipelineBodySchema
>;

export const TriggerReviewBodySchema = z.object({
  feature_id: z.string().nullable().optional(),
  diff_ref: z.string().optional(),
});
export type TriggerReviewBody = z.infer<typeof TriggerReviewBodySchema>;

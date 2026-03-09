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

// ---- Review Config ----

export const ReviewConfigSchema = z.object({
  agents_config: z.array(AgentConfigSchema),
  auto_trigger: z.boolean().default(false),
  updated_at: z.string().datetime().nullable().default(null),
});
export type ReviewConfig = z.infer<typeof ReviewConfigSchema>;

export const UpdateReviewConfigBodySchema = z.object({
  agents_config: z.array(AgentConfigSchema).optional(),
  auto_trigger: z.boolean().optional(),
});
export type UpdateReviewConfigBody = z.infer<typeof UpdateReviewConfigBodySchema>;

// ---- Review Queue Metrics ----

export const FindingsBySeveritySchema = z.object({
  critical: z.number().int().default(0),
  high: z.number().int().default(0),
  medium: z.number().int().default(0),
  low: z.number().int().default(0),
  info: z.number().int().default(0),
});
export type FindingsBySeverity = z.infer<typeof FindingsBySeveritySchema>;

export const FindingsByAgentSchema = z.object({
  agent_type: AgentTypeEnum,
  total_findings: z.number().int().default(0),
  critical_findings: z.number().int().default(0),
  avg_findings_per_review: z.number().default(0),
});
export type FindingsByAgent = z.infer<typeof FindingsByAgentSchema>;

export const ReviewQueueMetricsSchema = z.object({
  queue_size: z.number().int().default(0),
  avg_wait_time_minutes: z.number().default(0),
  avg_review_duration_minutes: z.number().default(0),
  pass_rate: z.number().default(0),
  escalation_rate: z.number().default(0),
  false_positive_rate: z.number().default(0),
  findings_by_severity: FindingsBySeveritySchema,
  findings_by_agent: z.array(FindingsByAgentSchema),
  computed_at: z.string().datetime(),
});
export type ReviewQueueMetrics = z.infer<typeof ReviewQueueMetricsSchema>;

export const MetricsCacheSchema = z.object({
  metrics: ReviewQueueMetricsSchema,
  cached_at: z.string().datetime(),
});
export type MetricsCache = z.infer<typeof MetricsCacheSchema>;

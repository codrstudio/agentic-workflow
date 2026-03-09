import { z } from "zod";

export const TraceSpanTypeEnum = z.enum([
  "wave",
  "step",
  "feature_attempt",
  "agent_call",
  "merge",
]);

export type TraceSpanType = z.infer<typeof TraceSpanTypeEnum>;

export const TraceSpanStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "skipped",
]);

export type TraceSpanStatus = z.infer<typeof TraceSpanStatusEnum>;

export const TraceStatusEnum = z.enum(["running", "completed", "failed"]);

export type TraceStatus = z.infer<typeof TraceStatusEnum>;

export const ToolCallSchema = z.object({
  tool: z.string(),
  timestamp: z.string().datetime(),
  duration_ms: z.number().nullable(),
  success: z.boolean(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

export const TraceSpanSchema = z.object({
  id: z.string(),
  parent_id: z.string().nullable(),
  trace_id: z.string(),
  name: z.string(),
  type: TraceSpanTypeEnum,
  status: TraceSpanStatusEnum,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  duration_ms: z.number().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  input_summary: z.string().nullable(),
  output_summary: z.string().nullable(),
  tokens_input: z.number().int().nullable(),
  tokens_output: z.number().int().nullable(),
  cost_usd: z.number().nullable(),
  tool_calls: z.array(ToolCallSchema),
  exit_code: z.number().int().nullable(),
  error: z.string().nullable(),
});

export type TraceSpan = z.infer<typeof TraceSpanSchema>;

export const PipelineTraceSchema = z.object({
  trace_id: z.string(),
  project_id: z.string().uuid(),
  wave: z.number().int(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime().nullable(),
  status: TraceStatusEnum,
  spans: z.array(TraceSpanSchema),
});

export type PipelineTrace = z.infer<typeof PipelineTraceSchema>;

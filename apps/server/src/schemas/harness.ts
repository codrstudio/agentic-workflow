import { z } from 'zod';

// Request schemas
export const StartRunRequestSchema = z.object({
  projectSlug: z.string().min(1, 'projectSlug is required'),
  workflowSlug: z.string().min(1, 'workflowSlug is required'),
  planSlug: z.string().optional(),
});
export type StartRunRequest = z.infer<typeof StartRunRequestSchema>;

// Run status enum
export const RunStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'stopped',
  'failed',
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

// Run record (from registry)
export const RunRecordSchema = z.object({
  id: z.string(),
  projectSlug: z.string(),
  workflowSlug: z.string(),
  planSlug: z.string().optional(),
  status: RunStatusSchema,
  created_at: z.string().datetime(),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  exit_code: z.number().int().optional(),
  reason: z.string().optional(),
});
export type RunRecord = z.infer<typeof RunRecordSchema>;

// Run detail response (what we return to client)
export const RunDetailSchema = z.object({
  id: z.string(),
  projectSlug: z.string(),
  workflowSlug: z.string(),
  planSlug: z.string().optional(),
  status: RunStatusSchema,
  created_at: z.string().datetime(),
  started_at: z.string().datetime().nullable(),
  finished_at: z.string().datetime().nullable(),
  exit_code: z.number().int().nullable(),
  reason: z.string().optional(),
});
export type RunDetail = z.infer<typeof RunDetailSchema>;

// Run creation response
export const RunCreatedSchema = z.object({
  run_id: z.string(),
  projectSlug: z.string(),
  workflowSlug: z.string(),
  status: RunStatusSchema,
  created_at: z.string().datetime(),
});
export type RunCreated = z.infer<typeof RunCreatedSchema>;

// Health response
export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  runs: z.number().int().nonnegative(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

// SSE event types
export const EngineEventTypeSchema = z.enum([
  'connected',
  'heartbeat',
  'status',
  'step.start',
  'step.complete',
  'step.fail',
  'loop.iteration',
  'wave.complete',
  'engine:event',
]);
export type EngineEventType = z.infer<typeof EngineEventTypeSchema>;

// SSE event structure
export const EngineEventSchema = z.object({
  type: EngineEventTypeSchema,
  data: z.string(),
  timestamp: z.string().datetime().optional(),
});
export type EngineEvent = z.infer<typeof EngineEventSchema>;

// Error response
export const ErrorResponseSchema = z.object({
  error: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Workspace status schemas (existing in harness.ts)
export const SpawnMetaSchema = z.object({
  task: z.string(),
  agent: z.string(),
  wave: z.number(),
  step: z.number(),
  parent_pid: z.number().optional(),
  pid: z.number().optional(),
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  exit_code: z.number().int().nullable().optional(),
  timed_out: z.boolean().optional(),
});
export type SpawnMeta = z.infer<typeof SpawnMetaSchema>;

export const LoopMetaSchema = z.object({
  status: z.string(),
  pid: z.number().optional(),
  iteration: z.number(),
  total: z.number(),
  done: z.number(),
  remaining: z.number(),
  features_done: z.number(),
  started_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  max_iterations: z.number().int().nullable().optional(),
  max_features: z.number().int().nullable().optional(),
  exit_reason: z.string().optional(),
});
export type LoopMeta = z.infer<typeof LoopMetaSchema>;

export const StepStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
]);
export type StepStatus = z.infer<typeof StepStatusSchema>;

export const StepInfoSchema = z.object({
  number: z.number().int(),
  name: z.string(),
  type: z.string(),
  task: z.string(),
  agent: z.string(),
  status: StepStatusSchema,
  started_at: z.string().datetime().optional(),
  finished_at: z.string().datetime().optional(),
  exit_code: z.number().int().nullable().optional(),
  duration_ms: z.number().int().nullable().optional(),
});
export type StepInfo = z.infer<typeof StepInfoSchema>;

export const WaveStatusSchema = z.enum([
  'running',
  'completed',
  'failed',
  'idle',
]);
export type WaveStatus = z.infer<typeof WaveStatusSchema>;

export const WaveInfoSchema = z.object({
  number: z.number().int(),
  steps: z.array(StepInfoSchema),
  status: WaveStatusSchema,
});
export type WaveInfo = z.infer<typeof WaveInfoSchema>;

export const WorkspaceStatusSchema = z.object({
  project: z.string(),
  waves: z.array(WaveInfoSchema),
  current_wave: z.number().int().nullable(),
  status: WaveStatusSchema,
});
export type WorkspaceStatus = z.infer<typeof WorkspaceStatusSchema>;

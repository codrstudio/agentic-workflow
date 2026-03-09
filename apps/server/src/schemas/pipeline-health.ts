import { z } from "zod";

export const StepStatusEnum = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "skipped",
  "circuit_broken",
]);

export const StepHealthEnum = z.enum(["healthy", "slow", "failing", "dead"]);

export const PipelineStatusEnum = z.enum([
  "healthy",
  "degraded",
  "unhealthy",
  "stopped",
]);

export const PipelineStepSchema = z.object({
  step_number: z.number().int(),
  task: z.string(),
  status: StepStatusEnum,
  health: StepHealthEnum,
  duration_seconds: z.number().nullable(),
  retries: z.number().int(),
  last_error: z.string().nullable(),
});

export type PipelineStep = z.infer<typeof PipelineStepSchema>;

export const CircuitBreakerSchema = z.object({
  triggered: z.boolean(),
  trigger_reason: z.string().nullable(),
  triggered_at: z.string().datetime().nullable(),
  consecutive_failures: z.number().int(),
  threshold: z.number().int(),
});

export type CircuitBreaker = z.infer<typeof CircuitBreakerSchema>;

export const PipelineHealthStatusSchema = z.object({
  project_id: z.string().uuid(),
  wave: z.number().int(),
  checked_at: z.string().datetime(),
  status: PipelineStatusEnum,
  steps: z.array(PipelineStepSchema),
  circuit_breaker: CircuitBreakerSchema,
});

export type PipelineHealthStatus = z.infer<typeof PipelineHealthStatusSchema>;

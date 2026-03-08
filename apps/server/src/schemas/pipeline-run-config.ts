import { z } from "zod";

export const RetryBackoffStrategySchema = z.enum(["fixed", "exponential"]);
export type RetryBackoffStrategy = z.infer<typeof RetryBackoffStrategySchema>;

export const PipelineRunConfigSchema = z.object({
  project_id: z.string().uuid(),
  circuit_breaker_threshold: z.number().int().min(1).default(3),
  circuit_breaker_cooldown_minutes: z.number().int().min(0).default(5),
  step_timeout_minutes: z.number().int().min(1).default(30),
  wave_timeout_minutes: z.number().int().min(1).default(180),
  max_retries_per_step: z.number().int().min(0).default(2),
  max_retries_per_feature: z.number().int().min(0).default(3),
  retry_backoff_strategy: RetryBackoffStrategySchema.default("fixed"),
  notify_on_failure: z.boolean().default(true),
  notify_on_circuit_break: z.boolean().default(true),
  notify_on_budget_alert: z.boolean().default(true),
  updated_at: z.string().datetime(),
});

export type PipelineRunConfig = z.infer<typeof PipelineRunConfigSchema>;

export const UpdatePipelineRunConfigSchema = z.object({
  circuit_breaker_threshold: z.number().int().min(1).optional(),
  circuit_breaker_cooldown_minutes: z.number().int().min(0).optional(),
  step_timeout_minutes: z.number().int().min(1).optional(),
  wave_timeout_minutes: z.number().int().min(1).optional(),
  max_retries_per_step: z.number().int().min(0).optional(),
  max_retries_per_feature: z.number().int().min(0).optional(),
  retry_backoff_strategy: RetryBackoffStrategySchema.optional(),
  notify_on_failure: z.boolean().optional(),
  notify_on_circuit_break: z.boolean().optional(),
  notify_on_budget_alert: z.boolean().optional(),
});

export type UpdatePipelineRunConfig = z.infer<typeof UpdatePipelineRunConfigSchema>;

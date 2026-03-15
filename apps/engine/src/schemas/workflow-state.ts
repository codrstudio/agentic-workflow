import { z } from 'zod';

export const WorkflowStepStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'interrupted',
  'skipped',
]);

export const WorkflowStepStateSchema = z.object({
  index: z.number(),
  task: z.string(),
  type: z.string(),
  status: WorkflowStepStatusSchema,
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  exit_code: z.number().nullable(),
  result: z.record(z.unknown()).optional(),
  artifacts: z.array(z.string()).optional(),
});

export const WorkflowStatusSchema = z.enum([
  'running',
  'completed',
  'stopped',
  'failed',
]);

export const WorkflowStateSchema = z.object({
  workflow: z.string(),
  wave: z.number(),
  sprint: z.number(),
  initialized_at: z.string(),
  status: WorkflowStatusSchema.optional(),
  stopped_reason: z.string().optional(),
  steps: z.array(WorkflowStepStateSchema),
});

export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;
export type WorkflowStepState = z.infer<typeof WorkflowStepStateSchema>;
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

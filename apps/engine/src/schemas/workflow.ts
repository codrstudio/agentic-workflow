import { z } from 'zod';
import { TaskFrontmatterSchema } from './task.js';

const WorkflowStepBase = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
  model_fallback: z.string().optional(),
});

const InlineTaskFields = {
  prompt: z.string().optional(),
  agent: z.enum(['coder', 'researcher', 'general']).optional(),
  description: z.string().optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  tier: TaskFrontmatterSchema.shape.tier,
  needs: z.array(z.enum(['sprint'])).optional(),
} as const;

export const SpawnAgentStepSchema = WorkflowStepBase.extend({
  type: z.literal('spawn-agent'),
  task: z.string().optional(),
  ...InlineTaskFields,
  schema: z.record(z.unknown()).optional(),
  stop_on: z.string().optional(),
});

export const FeatureLoopStepSchema = WorkflowStepBase.extend({
  type: z.literal('ralph-wiggum-loop'),
  task: z.string().optional(),
  ...InlineTaskFields,
  features_file: z.string().optional(),
});

export const ChainWorkflowStepSchema = WorkflowStepBase.extend({
  type: z.literal('chain-workflow'),
  workflow: z.string(),
});

export const SpawnWorkflowStepSchema = WorkflowStepBase.extend({
  type: z.literal('spawn-workflow'),
  workflow: z.string(),
});

export const StopOnWaveLimitStepSchema = WorkflowStepBase.extend({
  type: z.literal('stop-on-wave-limit'),
});

export const WorkflowStepSchema = z.discriminatedUnion('type', [
  SpawnAgentStepSchema,
  FeatureLoopStepSchema,
  ChainWorkflowStepSchema,
  SpawnWorkflowStepSchema,
  StopOnWaveLimitStepSchema,
]);

export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  sprint: z.boolean().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
});

export type SpawnAgentStep = z.infer<typeof SpawnAgentStepSchema>;
export type SpawnAgentCallStep = SpawnAgentStep;
export type FeatureLoopStep = z.infer<typeof FeatureLoopStepSchema>;
export type ChainWorkflowStep = z.infer<typeof ChainWorkflowStepSchema>;
export type SpawnWorkflowStep = z.infer<typeof SpawnWorkflowStepSchema>;
export type StopOnWaveLimitStep = z.infer<typeof StopOnWaveLimitStepSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

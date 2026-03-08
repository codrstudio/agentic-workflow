import { z } from 'zod';

const WorkflowStepBase = z.object({
  name: z.string().optional(),
  model: z.string().optional(),
  model_fallback: z.string().optional(),
});

export const SpawnAgentStepSchema = WorkflowStepBase.extend({
  type: z.literal('spawn-agent'),
  task: z.string(),
});

export const SpawnAgentCallStepSchema = WorkflowStepBase.extend({
  type: z.literal('spawn-agent-call'),
  task: z.string(),
  schema: z.record(z.unknown()),
  stop_on: z.string(),
});

export const FeatureLoopStepSchema = WorkflowStepBase.extend({
  type: z.literal('ralph-wiggum-loop'),
  task: z.string(),
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
  SpawnAgentCallStepSchema,
  FeatureLoopStepSchema,
  ChainWorkflowStepSchema,
  SpawnWorkflowStepSchema,
  StopOnWaveLimitStepSchema,
]);

export const WorkflowSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  steps: z.array(WorkflowStepSchema).min(1),
});

export type SpawnAgentStep = z.infer<typeof SpawnAgentStepSchema>;
export type SpawnAgentCallStep = z.infer<typeof SpawnAgentCallStepSchema>;
export type FeatureLoopStep = z.infer<typeof FeatureLoopStepSchema>;
export type ChainWorkflowStep = z.infer<typeof ChainWorkflowStepSchema>;
export type SpawnWorkflowStep = z.infer<typeof SpawnWorkflowStepSchema>;
export type StopOnWaveLimitStep = z.infer<typeof StopOnWaveLimitStepSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;

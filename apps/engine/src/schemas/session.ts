import { z } from 'zod';
import { ConfigSchema } from './config.js';
import { LoopStateSchema } from './loop-state.js';

export const SessionSummarySchema = z.object({
  id: z.string(),
  workflow: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'stopped', 'error']),
  created_at: z.string(),
  updated_at: z.string().optional(),
  features_total: z.number().int().nonnegative().optional(),
  features_done: z.number().int().nonnegative().optional(),
  current_feature: z.string().optional(),
});

export const SessionDetailSchema = SessionSummarySchema.extend({
  config: ConfigSchema,
  loop_state: LoopStateSchema.optional(),
  dir: z.string(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;
export type SessionDetail = z.infer<typeof SessionDetailSchema>;

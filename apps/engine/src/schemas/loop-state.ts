import { z } from 'zod';

export const LoopStateSchema = z.object({
  status: z.enum(['starting', 'running', 'between', 'exited']),
  pid: z.number().int().positive().optional(),
  iteration: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional(),
  done: z.number().int().nonnegative().optional(),
  remaining: z.number().int().nonnegative().optional(),
  feature_id: z.string().optional(),
  current_feature: z.string().optional(),
  features_done: z.union([z.array(z.string()), z.number().int().nonnegative()]).optional(),
  started_at: z.string(),
  updated_at: z.string(),
  exit_reason: z.string().optional(),
  max_iterations: z.number().int().positive().nullable().optional(),
  max_features: z.number().int().positive().nullable().optional(),
}).passthrough();

export type LoopState = z.infer<typeof LoopStateSchema>;

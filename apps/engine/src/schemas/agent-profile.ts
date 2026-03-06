import { z } from 'zod';

export const AgentProfileSchema = z.object({
  allowedTools: z.string(),
  max_turns: z.number().int().positive().optional(),
  rollback: z.enum(['stash', 'reset', 'none']).default('none'),
  timeout_minutes: z.number().positive().optional(),
  model: z.string().optional(),
});

export type AgentProfile = z.infer<typeof AgentProfileSchema>;

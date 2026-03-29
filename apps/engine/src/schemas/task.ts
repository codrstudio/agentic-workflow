import { z } from 'zod';
import { TierSlugSchema } from './tier.js';

export const TaskNeedSchema = z.enum(['sprint']);

export const TaskFrontmatterSchema = z.object({
  agent: z.enum(['coder', 'researcher', 'general']),
  description: z.string(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
  effort: z.enum(['low', 'medium', 'high']).optional(),
  tier: TierSlugSchema.optional(),
  needs: z.array(TaskNeedSchema).optional(),
});

export type TaskNeed = z.infer<typeof TaskNeedSchema>;

export type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;

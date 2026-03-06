import { z } from 'zod';

export const TaskFrontmatterSchema = z.object({
  agent: z.enum(['coder', 'researcher', 'general']),
  description: z.string(),
});

export type TaskFrontmatter = z.infer<typeof TaskFrontmatterSchema>;

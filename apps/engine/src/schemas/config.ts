import { z } from 'zod';

export const AgentConfigSchema = z.object({
  harness: z.string().default('claude-code'),
  profile: z.enum(['coder', 'researcher', 'general']).default('coder'),
  model: z.string().nullable().optional(),
  max_turns: z.number().int().positive().optional(),
  max_iterations: z.number().int().positive().nullable().optional(),
  max_features: z.number().int().positive().nullable().optional(),
  max_retries: z.number().int().positive().default(5),
  rollback: z.enum(['stash', 'reset', 'none']).default('stash'),
  timeout_minutes: z.number().positive().optional(),
});

export const ConfigSchema = z.object({
  session: z.string(),
  worktree: z.string(),
  agent: AgentConfigSchema,
  runs_dir: z.string(),
  slug: z.string().optional(),
  project: z.string().optional(),
  session_name: z.string().optional(),
  prp: z.string().optional(),
  prp_path: z.string().optional(),
  specs: z.union([z.string(), z.array(z.string())]).optional(),
  parent_workspace: z.string().optional(),
  parent_branch: z.string().optional(),
  branch: z.string().optional(),
  created_at: z.string().optional(),
  finished_at: z.string().optional(),
  notifications: z.array(z.any()).optional(),
  next_sessions: z.array(z.string()).optional(),
  docs: z.string().optional(),
  workflow: z.string().optional(),
}).passthrough();

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type Config = z.infer<typeof ConfigSchema>;

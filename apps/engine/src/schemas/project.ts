import { z } from 'zod';

export const RepoConfigSchema = z.object({
  url: z.string(),
  source_branch: z.string().default('main'),
  target_branch: z.string().optional(),
  auto_merge: z.boolean().default(true),
});

export type RepoConfig = z.infer<typeof RepoConfigSchema>;

export const ProjectConfigSchema = z.object({
  name: z.string(),
  slug: z.string(),
  description: z.string().optional(),
  repo: z.union([z.string(), RepoConfigSchema]).optional(),
  source_folder: z.string().optional(),
  target_folder: z.string().optional(),
  params: z.record(z.unknown()).optional(),
  plan: z.string().optional(),
  wave_limit: z.number().int().positive().optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

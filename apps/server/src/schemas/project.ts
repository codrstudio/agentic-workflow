import { z } from "zod";

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  settings: z.object({
    default_agent: z.string().default("general"),
    max_sources: z.number().default(100),
    params: z.record(z.string(), z.string()).default({}),
  }),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectBody = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export const UpdateProjectBody = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  settings: z
    .object({
      default_agent: z.string().optional(),
      max_sources: z.number().optional(),
      params: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

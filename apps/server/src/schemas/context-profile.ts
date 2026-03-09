import { z } from "zod";

export const ContextProfileSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  is_default: z.boolean().default(false),
  included_sources: z.array(z.string().uuid()).default([]),
  included_categories: z.array(z.string()).default([]),
  excluded_sources: z.array(z.string().uuid()).default([]),
  token_budget: z.number().int().min(0).default(24000),
  current_token_count: z.number().int().min(0).default(0),
  density_score: z.number().min(0).max(100).default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ContextProfile = z.infer<typeof ContextProfileSchema>;

export const CreateContextProfileBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).nullable().optional(),
  is_default: z.boolean().optional(),
  included_sources: z.array(z.string().uuid()).optional(),
  included_categories: z.array(z.string()).optional(),
  excluded_sources: z.array(z.string().uuid()).optional(),
  token_budget: z.number().int().min(0).optional(),
});

export const UpdateContextProfileBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  is_default: z.boolean().optional(),
  included_sources: z.array(z.string().uuid()).optional(),
  included_categories: z.array(z.string()).optional(),
  excluded_sources: z.array(z.string().uuid()).optional(),
  token_budget: z.number().int().min(0).optional(),
});

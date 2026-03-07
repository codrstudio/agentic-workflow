import { z } from "zod";

export const ContextProfileSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  source_ids: z.array(z.string().uuid()),
  is_default: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ContextProfile = z.infer<typeof ContextProfileSchema>;

export const CreateContextProfileBody = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  source_ids: z.array(z.string().uuid()),
  is_default: z.boolean().optional(),
});

export const UpdateContextProfileBody = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  source_ids: z.array(z.string().uuid()).optional(),
  is_default: z.boolean().optional(),
});

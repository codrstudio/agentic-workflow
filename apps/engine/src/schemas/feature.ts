import { z } from 'zod';

export const FeatureStatusSchema = z.enum([
  'failing', 'passing', 'skipped', 'pending', 'in_progress', 'blocked'
]);

export const FeatureSchema = z.object({
  id: z.string().regex(/^F-\d{3}$/),
  name: z.string(),
  description: z.string(),
  status: FeatureStatusSchema,
  priority: z.number().int().optional(),
  agent: z.enum(['researcher', 'general', 'coder']).optional(),
  dependencies: z.array(z.string()).default([]),
  wave: z.number().int().positive().optional(),
  tests: z.array(z.string()).optional(),
  retries: z.number().int().nonnegative().optional(),
  completed_at: z.string().datetime().optional(),
  skip_reason: z.string().optional(),
  prp_path: z.string().optional(),
  task: z.string().optional(),
}).passthrough();

export const FeaturesFileSchema = z.union([
  z.array(FeatureSchema),
  z.object({ features: z.array(FeatureSchema) }).passthrough(),
]);

export type FeatureStatus = z.infer<typeof FeatureStatusSchema>;
export type Feature = z.infer<typeof FeatureSchema>;
export type FeaturesFile = z.infer<typeof FeaturesFileSchema>;

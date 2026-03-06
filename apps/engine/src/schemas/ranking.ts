import { z } from 'zod';

export const DiscoverySchema = z.object({
  id: z.string().regex(/^D-\d{3}$/),
  type: z.enum(['pain', 'gain']),
  description: z.string(),
  score: z.number().int().min(1).max(10),
  discovered_at: z.number().int().positive(),
  last_reclassified_at: z.number().int().positive(),
  implemented_at: z.number().int().positive().optional(),
}).passthrough();

export const RankingSchema = z.object({
  wave: z.number().int().positive(),
  decision: z.enum(['go', 'stop']),
  discoveries: z.array(DiscoverySchema),
}).passthrough();

export type Discovery = z.infer<typeof DiscoverySchema>;
export type Ranking = z.infer<typeof RankingSchema>;

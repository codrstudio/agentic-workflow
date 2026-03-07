import { z } from 'zod';

export const TierSlugSchema = z.enum(['cheap', 'light', 'balanced', 'thorough', 'strong', 'max']);
export type TierSlug = z.infer<typeof TierSlugSchema>;

export const PlanSchema = z.object({
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  tiers: z.record(z.string(), TierSlugSchema),
  escalation: z.record(z.string(), TierSlugSchema).optional(),
});
export type Plan = z.infer<typeof PlanSchema>;

export const TIER_MAP: Record<TierSlug, { model: string; effort?: string }> = {
  cheap:    { model: 'haiku' },
  light:    { model: 'sonnet', effort: 'low' },
  balanced: { model: 'sonnet', effort: 'medium' },
  thorough: { model: 'sonnet', effort: 'high' },
  strong:   { model: 'opus',   effort: 'medium' },
  max:      { model: 'opus',   effort: 'high' },
};

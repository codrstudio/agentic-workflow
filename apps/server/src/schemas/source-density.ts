import { z } from "zod";

export const DensityFreshnessEnum = z.enum(["current", "stale", "outdated"]);

export const DensityRecommendationTypeEnum = z.enum([
  "split",
  "merge",
  "remove",
  "update",
  "summarize",
]);

export const DensityRecommendationSchema = z.object({
  type: DensityRecommendationTypeEnum,
  reason: z.string(),
  target_source_id: z.string().uuid().nullable().optional(),
});

export const SourceDensityMetricsSchema = z.object({
  source_id: z.string().uuid(),
  project_id: z.string().uuid(),
  token_count: z.number().int().min(0),
  information_density: z.number().min(0).max(100),
  redundancy_score: z.number().min(0).max(100),
  relevance_score: z.number().min(0).max(100),
  freshness: DensityFreshnessEnum,
  usage_count: z.number().int().min(0),
  last_used_at: z.string().datetime().nullable().optional(),
  recommendations: z.array(DensityRecommendationSchema),
  computed_at: z.string().datetime(),
});

export type SourceDensityMetrics = z.infer<typeof SourceDensityMetricsSchema>;
export type DensityRecommendation = z.infer<typeof DensityRecommendationSchema>;

export const AnalyzeDensityBodySchema = z.object({
  source_ids: z.array(z.string().uuid()).optional(),
});

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

export const QualityRecommendationSchema = z.object({
  priority: z.number().int().min(1),
  action: z.string(),
  impact_tokens: z.number().int().min(0),
  affected_sources: z.array(z.string().uuid()),
});

export const ContextQualityReportSchema = z.object({
  project_id: z.string().uuid(),
  profile_id: z.string().uuid().nullable().optional(),
  total_tokens: z.number().int().min(0),
  token_budget: z.number().int().min(0),
  budget_utilization: z.number().min(0),
  overall_density_score: z.number().min(0).max(100),
  redundancy_percentage: z.number().min(0).max(100),
  low_relevance_percentage: z.number().min(0).max(100),
  top_recommendations: z.array(QualityRecommendationSchema),
  computed_at: z.string().datetime(),
});

export const ContextQualityCacheSchema = z.object({
  report: ContextQualityReportSchema,
  expires_at: z.string().datetime(),
});

export type QualityRecommendation = z.infer<typeof QualityRecommendationSchema>;
export type ContextQualityReport = z.infer<typeof ContextQualityReportSchema>;
export type ContextQualityCache = z.infer<typeof ContextQualityCacheSchema>;

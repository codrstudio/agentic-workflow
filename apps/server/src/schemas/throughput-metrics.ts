import { z } from "zod";

export const FeatureLevelMetricsSchema = z.object({
  completed: z.number().int().min(0),
  in_progress: z.number().int().min(0),
  blocked: z.number().int().min(0),
  failed: z.number().int().min(0),
  avg_cycle_time_hours: z.number().nullable(),
  first_pass_rate: z.number().min(0).max(1),
});

export const DelegationRatioSchema = z.object({
  none: z.number().min(0).max(1),
  partial: z.number().min(0).max(1),
  majority: z.number().min(0).max(1),
  full: z.number().min(0).max(1),
});

export const AIEffectivenessMetricsSchema = z.object({
  delegation_ratio: DelegationRatioSchema,
  rework_ratio: z.number().min(0).max(1),
  human_intervention_rate: z.number().min(0).max(1),
});

export const FeaturesPerWeekEntrySchema = z.object({
  week: z.string(), // ISO week label: "YYYY-Www"
  count: z.number().int().min(0),
});

export const QualityMetricsSchema = z.object({
  review_pass_rate: z.number().min(0).max(1),
  features_per_week: z.array(FeaturesPerWeekEntrySchema),
});

export const ThroughputMetricsSchema = z.object({
  feature_level: FeatureLevelMetricsSchema,
  ai_effectiveness: AIEffectivenessMetricsSchema,
  quality: QualityMetricsSchema,
  period_days: z.number().int().positive(),
  computed_at: z.string().datetime(),
});

export type ThroughputMetrics = z.infer<typeof ThroughputMetricsSchema>;

export const BottleneckEntrySchema = z.object({
  phase: z.string(),
  avg_duration_hours: z.number().min(0),
  failure_rate: z.number().min(0).max(1),
  features_affected: z.number().int().min(0),
});

export type BottleneckEntry = z.infer<typeof BottleneckEntrySchema>;

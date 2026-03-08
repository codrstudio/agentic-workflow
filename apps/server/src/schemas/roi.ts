import { z } from "zod";

export const ROIConfigSchema = z.object({
  project_id: z.string().uuid(),
  developer_hourly_rate_usd: z.number().positive().default(75),
  baseline_hours_per_feature: z.number().positive().default(8),
  updated_at: z.string().datetime(),
});

export type ROIConfig = z.infer<typeof ROIConfigSchema>;

export const PutROIConfigBody = z.object({
  developer_hourly_rate_usd: z.number().positive().optional(),
  baseline_hours_per_feature: z.number().positive().optional(),
});

export type PutROIConfigBody = z.infer<typeof PutROIConfigBody>;

export const ROISnapshotSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  roi_ratio: z.number(),
  cost_per_feature_usd: z.number().nonnegative(),
  first_pass_accuracy: z.number().min(0).max(1),
  rework_ratio: z.number().min(0).max(1),
  total_cost_usd: z.number().nonnegative(),
  features_completed: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
});

export type ROISnapshot = z.infer<typeof ROISnapshotSchema>;

export const CreateROISnapshotBody = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  roi_ratio: z.number(),
  cost_per_feature_usd: z.number().nonnegative(),
  first_pass_accuracy: z.number().min(0).max(1),
  rework_ratio: z.number().min(0).max(1),
  total_cost_usd: z.number().nonnegative(),
  features_completed: z.number().int().nonnegative(),
});

export type CreateROISnapshotBody = z.infer<typeof CreateROISnapshotBody>;

export const CoreROISchema = z.object({
  total_cost_usd: z.number().nonnegative(),
  cost_per_feature_usd: z.number().nonnegative(),
  features_completed: z.number().int().nonnegative(),
  estimated_dev_hours_saved: z.number().nonnegative(),
  estimated_dev_cost_saved_usd: z.number().nonnegative(),
  roi_ratio: z.number(),
});

export const AIQualitySchema = z.object({
  ai_rework_ratio: z.number().min(0).max(1),
  first_pass_accuracy: z.number().min(0).max(1),
  ai_vs_human_defect_rate: z.number().nullable(),
});

export const CostTrendSchema = z.object({
  current_week: z.number().nonnegative(),
  previous_week: z.number().nonnegative(),
  change_pct: z.number(),
});

export const ByModelEntrySchema = z.object({
  model: z.string(),
  cost_usd: z.number().nonnegative(),
  features: z.number().int().nonnegative(),
  first_pass_rate: z.number().min(0).max(1),
  avg_cycle_time: z.number().nonnegative(),
});

export const AIROIMetricsSchema = z.object({
  core_roi: CoreROISchema,
  ai_quality: AIQualitySchema,
  cost_trend: CostTrendSchema,
  by_model: z.array(ByModelEntrySchema),
  period_days: z.number().int().positive(),
  computed_at: z.string().datetime(),
});

export type AIROIMetrics = z.infer<typeof AIROIMetricsSchema>;

export const SprintROISchema = z.object({
  sprint: z.number().int().positive(),
  roi_ratio: z.number(),
  cost_per_feature: z.number().nonnegative(),
  features: z.number().int().nonnegative(),
  first_pass_rate: z.number().min(0).max(1),
  total_cost_usd: z.number().nonnegative(),
});

export type SprintROI = z.infer<typeof SprintROISchema>;

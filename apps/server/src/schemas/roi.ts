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

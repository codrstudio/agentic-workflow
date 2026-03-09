import { z } from "zod";

export const AIProductivitySnapshotSchema = z.object({
  project_id: z.string(),
  period_days: z.number().int().positive(),
  snapshot_date: z.string().datetime(),
  total_features: z.number().int().min(0),
  ai_features: z.number().int().min(0),
  human_features: z.number().int().min(0),
  ai_rework_ratio: z.number().min(0).max(1),
  human_rework_ratio: z.number().min(0).max(1),
  first_pass_accuracy: z.number().min(0).max(1),
  defect_introduction_rate_ai: z.number().min(0).max(1),
  defect_introduction_rate_human: z.number().min(0).max(1),
  verification_tax_ratio: z.number().min(0),
  net_roi_hours: z.number(),
  total_ai_cost_usd: z.number().min(0),
  total_generation_hours: z.number().min(0),
  total_review_hours: z.number().min(0),
  total_rework_hours: z.number().min(0),
  total_time_saved_hours: z.number().min(0),
  created_at: z.string().datetime(),
});

export type AIProductivitySnapshot = z.infer<typeof AIProductivitySnapshotSchema>;

export const ProductivityHistoryEntrySchema = z.object({
  week_start: z.string(),
  snapshot: AIProductivitySnapshotSchema,
});

export type ProductivityHistoryEntry = z.infer<typeof ProductivityHistoryEntrySchema>;

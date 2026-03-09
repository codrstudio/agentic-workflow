import { z } from "zod";
import { OriginSourceEnum } from "./artifact-origin.js";

export const FeatureProductivityRecordSchema = z.object({
  feature_id: z.string(),
  project_id: z.string(),
  origin: OriginSourceEnum,
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  total_duration_hours: z.number().min(0).optional(),
  review_rounds: z.number().int().min(0).default(0),
  rework_count: z.number().int().min(0).default(0),
  defects_found: z.number().int().min(0).default(0),
  first_pass_accepted: z.boolean().default(false),
  ai_tokens_used: z.number().int().min(0).default(0),
  ai_cost_usd: z.number().min(0).default(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type FeatureProductivityRecord = z.infer<typeof FeatureProductivityRecordSchema>;

export const CreateFeatureProductivityBody = z.object({
  origin: OriginSourceEnum,
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  total_duration_hours: z.number().min(0).optional(),
  review_rounds: z.number().int().min(0).optional(),
  rework_count: z.number().int().min(0).optional(),
  defects_found: z.number().int().min(0).optional(),
  first_pass_accepted: z.boolean().optional(),
  ai_tokens_used: z.number().int().min(0).optional(),
  ai_cost_usd: z.number().min(0).optional(),
});

export type CreateFeatureProductivityBody = z.infer<typeof CreateFeatureProductivityBody>;

export const PatchFeatureProductivityBody = z.object({
  origin: OriginSourceEnum.optional(),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  total_duration_hours: z.number().min(0).optional(),
  review_rounds: z.number().int().min(0).optional(),
  rework_count: z.number().int().min(0).optional(),
  defects_found: z.number().int().min(0).optional(),
  first_pass_accepted: z.boolean().optional(),
  ai_tokens_used: z.number().int().min(0).optional(),
  ai_cost_usd: z.number().min(0).optional(),
});

export type PatchFeatureProductivityBody = z.infer<typeof PatchFeatureProductivityBody>;

import { z } from "zod";
import { OriginSourceEnum } from "./artifact-origin.js";

export const DefectSeverityEnum = z.enum([
  "critical",
  "major",
  "minor",
  "cosmetic",
]);

export type DefectSeverity = z.infer<typeof DefectSeverityEnum>;

export const DefectDetectorEnum = z.enum([
  "quality_gate",
  "agent_review",
  "human_review",
  "runtime",
]);

export type DefectDetector = z.infer<typeof DefectDetectorEnum>;

export const DefectStatusEnum = z.enum([
  "open",
  "in_progress",
  "resolved",
  "wont_fix",
]);

export type DefectStatus = z.infer<typeof DefectStatusEnum>;

export const DefectRecordSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  title: z.string(),
  description: z.string(),
  severity: DefectSeverityEnum,
  origin: OriginSourceEnum,
  source_feature_id: z.string().optional(),
  source_artifact_id: z.string().uuid().optional(),
  source_session_id: z.string().uuid().optional(),
  detected_by: DefectDetectorEnum,
  detected_at: z.string().datetime(),
  resolved_at: z.string().datetime().optional(),
  status: DefectStatusEnum,
});

export type DefectRecord = z.infer<typeof DefectRecordSchema>;

export const CreateDefectBody = z.object({
  title: z.string().min(1),
  description: z.string(),
  severity: DefectSeverityEnum,
  source_feature_id: z.string().optional(),
  source_artifact_id: z.string().uuid().optional(),
  source_session_id: z.string().uuid().optional(),
  detected_by: DefectDetectorEnum,
  origin: OriginSourceEnum.optional(),
});

export type CreateDefectBody = z.infer<typeof CreateDefectBody>;

export const PatchDefectBody = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  severity: DefectSeverityEnum.optional(),
  status: DefectStatusEnum.optional(),
  resolved_at: z.string().datetime().optional(),
});

export type PatchDefectBody = z.infer<typeof PatchDefectBody>;

export const DefectMetricsSchema = z.object({
  project_id: z.string(),
  computed_at: z.string().datetime(),
  period_days: z.number(),
  total_defects: z.number(),
  defects_by_origin: z.record(z.string(), z.number()),
  defects_by_severity: z.record(z.string(), z.number()),
  defects_by_detector: z.record(z.string(), z.number()),
  ai_defect_rate: z.number(),
  human_defect_rate: z.number(),
  avg_resolution_time_hours: z.number(),
  open_defects_count: z.number(),
});

export type DefectMetrics = z.infer<typeof DefectMetricsSchema>;

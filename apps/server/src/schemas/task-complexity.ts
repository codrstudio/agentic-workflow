import { z } from "zod";

export const TaskComplexityLevelEnum = z.enum([
  "trivial",
  "small",
  "medium",
  "large",
]);

export type TaskComplexityLevel = z.infer<typeof TaskComplexityLevelEnum>;

export const ClassificationMethodEnum = z.enum([
  "manual",
  "auto_heuristic",
  "auto_ai",
]);

export const TaskComplexitySignalsSchema = z.object({
  files_estimated: z.number().int().optional(),
  components_affected: z.number().int().optional(),
  has_db_changes: z.boolean().optional(),
  has_api_changes: z.boolean().optional(),
  has_ui_changes: z.boolean().optional(),
  cross_cutting: z.boolean().optional(),
});

export const SpecTemplateNameEnum = z.enum([
  "checklist",
  "spec_resumida",
  "spec_completa",
  "prp_completo",
]);

export const TaskComplexitySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  title: z.string(),
  description: z.string(),
  complexity_level: TaskComplexityLevelEnum,
  classification_method: ClassificationMethodEnum,
  confidence: z.number().min(0).max(1).optional(),
  signals: TaskComplexitySignalsSchema.optional(),
  spec_template: SpecTemplateNameEnum,
  created_at: z.string().datetime(),
});

export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;

export const ClassifyTaskBody = z.object({
  title: z.string().min(1),
  description: z.string(),
  method: ClassificationMethodEnum.default("auto_heuristic"),
  complexity_level: TaskComplexityLevelEnum.optional(),
});

export type ClassifyTaskBody = z.infer<typeof ClassifyTaskBody>;

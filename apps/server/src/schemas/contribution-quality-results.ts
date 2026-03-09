import { z } from "zod";

// --- ContributionQualityResult ---

export const QualityFlagSchema = z.object({
  type: z.enum([
    "ai_pattern",
    "duplicated_code",
    "security_vulnerability",
    "acr_violation",
    "missing_tests",
  ]),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string(),
  file: z.string().optional(),
  line: z.number().int().optional(),
});

export const QualityScoresSchema = z.object({
  originality: z.number().min(0).max(100),
  test_coverage: z.number().min(0).max(100),
  code_duplication: z.number().min(0).max(100),
  security: z.number().min(0).max(100),
  architectural_conformance: z.number().min(0).max(100),
});

export const ContributionQualityResultSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  feature_id: z.string().nullable().optional(),
  context: z.enum(["agent_output", "external_pr"]),
  scores: QualityScoresSchema,
  overall_score: z.number().min(0).max(100),
  passed: z.boolean(),
  auto_rejected: z.boolean(),
  flags: z.array(QualityFlagSchema),
  evaluated_at: z.string(),
  evaluator_agent: z.string().optional(),
});
export type ContributionQualityResult = z.infer<
  typeof ContributionQualityResultSchema
>;

export const CreateContributionQualityResultBody = z.object({
  feature_id: z.string().nullable().optional(),
  context: z.enum(["agent_output", "external_pr"]),
  scores: QualityScoresSchema,
  overall_score: z.number().min(0).max(100),
  passed: z.boolean(),
  auto_rejected: z.boolean(),
  flags: z.array(QualityFlagSchema).default([]),
  evaluated_at: z.string().optional(),
  evaluator_agent: z.string().optional(),
});
export type CreateContributionQualityResultBody = z.infer<
  typeof CreateContributionQualityResultBody
>;

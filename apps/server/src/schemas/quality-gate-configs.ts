import { z } from "zod";

// --- TestCoverageGateConfig ---

export const CoverageToolEnum = z.enum(["vitest", "jest", "c8", "custom"]);
export type CoverageTool = z.infer<typeof CoverageToolEnum>;

export const TestCoverageGateConfigSchema = z.object({
  project_id: z.string(),
  enabled: z.boolean().default(false),
  coverage_threshold_pct: z.number().min(0).max(100).default(70),
  coverage_tool: CoverageToolEnum.default("vitest"),
  custom_command: z.string().optional(),
  report_dir: z.string().default("coverage"),
  fail_on_uncovered_files: z.boolean().default(false),
  updated_at: z.string(),
});
export type TestCoverageGateConfig = z.infer<typeof TestCoverageGateConfigSchema>;

export const PatchTestCoverageGateConfigBody = z.object({
  enabled: z.boolean().optional(),
  coverage_threshold_pct: z.number().min(0).max(100).optional(),
  coverage_tool: CoverageToolEnum.optional(),
  custom_command: z.string().nullable().optional(),
  report_dir: z.string().optional(),
  fail_on_uncovered_files: z.boolean().optional(),
});
export type PatchTestCoverageGateConfigBody = z.infer<typeof PatchTestCoverageGateConfigBody>;

// --- ContributionQualityConfig ---

export const ContributionQualityConfigSchema = z.object({
  project_id: z.string(),
  enabled: z.boolean().default(false),
  min_quality_score: z.number().min(0).max(100).default(60),
  auto_reject_below: z.number().min(0).max(100).default(30),
  check_ai_patterns: z.boolean().default(true),
  check_test_coverage: z.boolean().default(true),
  check_code_duplication: z.boolean().default(true),
  check_security_patterns: z.boolean().default(true),
  check_architectural_conformance: z.boolean().default(true),
  updated_at: z.string(),
});
export type ContributionQualityConfig = z.infer<typeof ContributionQualityConfigSchema>;

export const PatchContributionQualityConfigBody = z.object({
  enabled: z.boolean().optional(),
  min_quality_score: z.number().min(0).max(100).optional(),
  auto_reject_below: z.number().min(0).max(100).optional(),
  check_ai_patterns: z.boolean().optional(),
  check_test_coverage: z.boolean().optional(),
  check_code_duplication: z.boolean().optional(),
  check_security_patterns: z.boolean().optional(),
  check_architectural_conformance: z.boolean().optional(),
});
export type PatchContributionQualityConfigBody = z.infer<typeof PatchContributionQualityConfigBody>;

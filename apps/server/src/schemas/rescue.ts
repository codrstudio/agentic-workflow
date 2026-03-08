import { z } from "zod";

export const RescuePhaseEnum = z.enum([
  "audit",
  "reverse_spec",
  "gap_analysis",
  "remediation",
  "execution",
  "validation",
]);

export const RescueProjectSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string(),
  source_path: z.string(),
  phase: RescuePhaseEnum.default("audit"),
  phases_completed: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateRescueProjectBody = z.object({
  name: z.string(),
  source_path: z.string(),
});

export const PatchRescueProjectBody = z.object({
  name: z.string().optional(),
  source_path: z.string().optional(),
  phase: RescuePhaseEnum.optional(),
});

export type RescueProject = z.infer<typeof RescueProjectSchema>;

// CodebaseAudit

export const AuditIssueSeverityEnum = z.enum(["critical", "high", "medium", "low"]);

export const AuditIssueSchema = z.object({
  category: z.string(),
  severity: AuditIssueSeverityEnum,
  description: z.string(),
  file_path: z.string().nullable(),
});

export const AuditMetricsSchema = z.object({
  files: z.number(),
  lines: z.number(),
  languages: z.array(z.string()),
});

export const AuditHealthSchema = z.object({
  has_tests: z.boolean(),
  test_coverage_estimate: z.enum(["low", "medium", "high"]).nullable(),
  has_ci_cd: z.boolean(),
  has_documentation: z.boolean(),
  has_type_safety: z.boolean(),
  dependency_health: z.enum(["healthy", "outdated", "vulnerable"]),
});

export const RescueDifficultyEnum = z.enum(["low", "medium", "high", "extreme"]);

export const CodebaseAuditSchema = z.object({
  id: z.string().uuid(),
  rescue_id: z.string().uuid(),
  metrics: AuditMetricsSchema,
  health: AuditHealthSchema,
  issues: z.array(AuditIssueSchema),
  ai_summary: z.string(),
  rescue_difficulty: RescueDifficultyEnum,
  estimated_effort_hours: z.number(),
  created_at: z.string(),
});

export type CodebaseAudit = z.infer<typeof CodebaseAuditSchema>;

// ReverseSpec

export const ReverseSpecIssueSeverityEnum = z.enum(["critical", "high", "medium", "low"]);

export const ReverseSpecIssueSchema = z.object({
  description: z.string(),
  severity: ReverseSpecIssueSeverityEnum,
});

export const ReverseSpecSchema = z.object({
  id: z.string().uuid(),
  rescue_id: z.string().uuid(),
  module_name: z.string(),
  file_paths: z.array(z.string()),
  inferred_purpose: z.string(),
  current_behavior: z.string(),
  issues_found: z.array(ReverseSpecIssueSchema),
  recommended_changes: z.array(z.string()),
  promoted_to_spec_id: z.string().uuid().nullable(),
  created_at: z.string(),
});

export type ReverseSpec = z.infer<typeof ReverseSpecSchema>;

// RemediationPlan

export const RemediationItemCategoryEnum = z.enum([
  "testing",
  "types",
  "architecture",
  "security",
  "documentation",
  "performance",
]);

export const RemediationItemEffortEnum = z.enum(["small", "medium", "large", "xlarge"]);

export const RemediationItemStatusEnum = z.enum([
  "pending",
  "in_progress",
  "completed",
  "skipped",
]);

export const RemediationItemSchema = z.object({
  id: z.string().uuid(),
  priority: z.number().int().min(1),
  category: RemediationItemCategoryEnum,
  title: z.string(),
  description: z.string(),
  effort_estimate: RemediationItemEffortEnum,
  status: RemediationItemStatusEnum.default("pending"),
  feature_id: z.string().nullable().default(null),
});

export const RemediationPlanSchema = z.object({
  id: z.string().uuid(),
  rescue_id: z.string().uuid(),
  items: z.array(RemediationItemSchema),
  total_effort_estimate: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const PatchRemediationBody = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        priority: z.number().int().min(1).optional(),
        status: RemediationItemStatusEnum.optional(),
        feature_id: z.string().nullable().optional(),
      })
    )
    .optional(),
});

export type RemediationItem = z.infer<typeof RemediationItemSchema>;
export type RemediationPlan = z.infer<typeof RemediationPlanSchema>;

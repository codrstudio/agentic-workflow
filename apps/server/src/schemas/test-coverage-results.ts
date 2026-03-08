import { z } from "zod";

// --- TestCoverageResult ---

export const TestCoverageResultSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  feature_id: z.string(),
  attempt: z.number().int().min(1),
  lines_pct: z.number().min(0).max(100),
  branches_pct: z.number().min(0).max(100),
  functions_pct: z.number().min(0).max(100),
  statements_pct: z.number().min(0).max(100),
  overall_pct: z.number().min(0).max(100),
  threshold_pct: z.number().min(0).max(100),
  passed: z.boolean(),
  uncovered_files: z.array(z.string()),
  tool_used: z.string(),
  stdout_preview: z.string().max(1000).nullable().optional(),
  executed_at: z.string(),
  duration_ms: z.number().int().min(0),
});
export type TestCoverageResult = z.infer<typeof TestCoverageResultSchema>;

export const CreateTestCoverageResultBody = z.object({
  feature_id: z.string(),
  attempt: z.number().int().min(1),
  lines_pct: z.number().min(0).max(100),
  branches_pct: z.number().min(0).max(100),
  functions_pct: z.number().min(0).max(100),
  statements_pct: z.number().min(0).max(100),
  overall_pct: z.number().min(0).max(100),
  threshold_pct: z.number().min(0).max(100),
  passed: z.boolean(),
  uncovered_files: z.array(z.string()).default([]),
  tool_used: z.string(),
  stdout_preview: z.string().max(1000).nullable().optional(),
  duration_ms: z.number().int().min(0),
});
export type CreateTestCoverageResultBody = z.infer<typeof CreateTestCoverageResultBody>;

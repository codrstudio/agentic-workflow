import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// --- Types (mirrors server schemas) ---

export interface TestCoverageResult {
  id: string;
  project_id: string;
  feature_id: string;
  attempt: number;
  lines_pct: number;
  branches_pct: number;
  functions_pct: number;
  statements_pct: number;
  overall_pct: number;
  threshold_pct: number;
  passed: boolean;
  uncovered_files: string[];
  tool_used: string;
  stdout_preview: string | null;
  executed_at: string;
  duration_ms: number;
}

export interface QualityFlag {
  type: "ai_pattern" | "duplicated_code" | "security_vulnerability" | "acr_violation" | "missing_tests";
  severity: "info" | "warning" | "error";
  message: string;
  file?: string;
  line?: number;
}

export interface ContributionQualityResult {
  id: string;
  project_id: string;
  feature_id: string | null;
  context: "agent_output" | "external_pr";
  scores: {
    originality: number;
    test_coverage: number;
    code_duplication: number;
    security: number;
    architectural_conformance: number;
  };
  overall_score: number;
  passed: boolean;
  auto_rejected: boolean;
  flags: QualityFlag[];
  evaluated_at: string;
  evaluator_agent?: string;
}

export interface FeatureQualityData {
  coverage: TestCoverageResult | null;
  quality: ContributionQualityResult | null;
}

// --- Query keys ---

export const featureQualityKeys = {
  all: (slug: string) => ["feature-quality", slug] as const,
  feature: (slug: string, sprint: number, featureId: string) =>
    [...featureQualityKeys.all(slug), sprint, featureId] as const,
  coverageList: (slug: string) =>
    [...featureQualityKeys.all(slug), "coverage-list"] as const,
  qualityList: (slug: string) =>
    [...featureQualityKeys.all(slug), "quality-list"] as const,
};

// --- Hooks ---

/** Fetch coverage + quality for a single feature */
export function useFeatureQuality(projectSlug: string, sprint: number, featureId: string) {
  return useQuery({
    queryKey: featureQualityKeys.feature(projectSlug, sprint, featureId),
    queryFn: () =>
      apiFetch<FeatureQualityData>(
        `/hub/projects/${projectSlug}/sprints/${sprint}/features/${featureId}/quality`
      ),
  });
}

/** Fetch all coverage results for a project (for summary tab) */
export function useAllCoverageResults(projectSlug: string) {
  return useQuery({
    queryKey: featureQualityKeys.coverageList(projectSlug),
    queryFn: () =>
      apiFetch<TestCoverageResult[]>(
        `/hub/projects/${projectSlug}/test-coverage-results?limit=500`
      ),
  });
}

/** Fetch all contribution quality results for a project (for summary tab) */
export function useAllQualityResults(projectSlug: string) {
  return useQuery({
    queryKey: featureQualityKeys.qualityList(projectSlug),
    queryFn: () =>
      apiFetch<ContributionQualityResult[]>(
        `/hub/projects/${projectSlug}/contribution-quality-results?limit=500`
      ),
  });
}

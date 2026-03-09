import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface TestCoverageGateConfig {
  project_id: string;
  enabled: boolean;
  coverage_threshold_pct: number;
  coverage_tool: "vitest" | "jest" | "c8" | "custom";
  custom_command?: string | null;
  report_dir: string;
  fail_on_uncovered_files: boolean;
  updated_at: string;
}

export interface ContributionQualityConfig {
  project_id: string;
  enabled: boolean;
  min_quality_score: number;
  auto_reject_below: number;
  check_ai_patterns: boolean;
  check_test_coverage: boolean;
  check_code_duplication: boolean;
  check_security_patterns: boolean;
  check_architectural_conformance: boolean;
  updated_at: string;
}

export const TEST_COVERAGE_DEFAULTS: Omit<TestCoverageGateConfig, "project_id" | "updated_at"> = {
  enabled: false,
  coverage_threshold_pct: 70,
  coverage_tool: "vitest",
  custom_command: null,
  report_dir: "coverage",
  fail_on_uncovered_files: false,
};

export const CONTRIBUTION_QUALITY_DEFAULTS: Omit<ContributionQualityConfig, "project_id" | "updated_at"> = {
  enabled: false,
  min_quality_score: 60,
  auto_reject_below: 30,
  check_ai_patterns: true,
  check_test_coverage: true,
  check_code_duplication: true,
  check_security_patterns: true,
  check_architectural_conformance: true,
};

const testCoverageKeys = {
  all: (slug: string) => ["test-coverage-gate-config", slug] as const,
  detail: (slug: string) => [...testCoverageKeys.all(slug), "detail"] as const,
};

const contributionQualityKeys = {
  all: (slug: string) => ["contribution-quality-config", slug] as const,
  detail: (slug: string) => [...contributionQualityKeys.all(slug), "detail"] as const,
};

export function useTestCoverageGateConfig(projectSlug: string) {
  return useQuery({
    queryKey: testCoverageKeys.detail(projectSlug),
    queryFn: () =>
      apiFetch<TestCoverageGateConfig>(
        `/hub/projects/${projectSlug}/test-coverage-gate-config`
      ),
  });
}

export function useUpdateTestCoverageGateConfig(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<TestCoverageGateConfig>) =>
      apiFetch<TestCoverageGateConfig>(
        `/hub/projects/${projectSlug}/test-coverage-gate-config`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        }
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(testCoverageKeys.detail(projectSlug), data);
    },
  });
}

export function useContributionQualityConfig(projectSlug: string) {
  return useQuery({
    queryKey: contributionQualityKeys.detail(projectSlug),
    queryFn: () =>
      apiFetch<ContributionQualityConfig>(
        `/hub/projects/${projectSlug}/contribution-quality-config`
      ),
  });
}

export function useUpdateContributionQualityConfig(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<ContributionQualityConfig>) =>
      apiFetch<ContributionQualityConfig>(
        `/hub/projects/${projectSlug}/contribution-quality-config`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        }
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(contributionQualityKeys.detail(projectSlug), data);
    },
  });
}

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ---- Types ----

export type RescuePhase =
  | "audit"
  | "reverse_spec"
  | "gap_analysis"
  | "remediation"
  | "execution"
  | "validation";

export interface RescueProject {
  id: string;
  project_id: string;
  name: string;
  source_path: string;
  phase: RescuePhase;
  phases_completed: string[];
  created_at: string;
  updated_at: string;
}

export type RescueDifficulty = "low" | "medium" | "high" | "extreme";
export type DependencyHealth = "healthy" | "outdated" | "vulnerable";
export type IssueSeverity = "critical" | "high" | "medium" | "low";

export interface AuditIssue {
  category: string;
  severity: IssueSeverity;
  description: string;
  file_path: string | null;
}

export interface CodebaseAudit {
  id: string;
  rescue_id: string;
  metrics: {
    files: number;
    lines: number;
    languages: string[];
  };
  health: {
    has_tests: boolean;
    test_coverage_estimate: string | null;
    has_ci_cd: boolean;
    has_documentation: boolean;
    has_type_safety: boolean;
    dependency_health: DependencyHealth;
  };
  issues: AuditIssue[];
  ai_summary: string;
  rescue_difficulty: RescueDifficulty;
  estimated_effort_hours: number;
  created_at: string;
}

export interface IssueFound {
  description: string;
  severity: IssueSeverity;
}

export interface ReverseSpec {
  id: string;
  rescue_id: string;
  module_name: string;
  file_paths: string[];
  inferred_purpose: string;
  current_behavior: string;
  issues_found: IssueFound[];
  recommended_changes: string[];
  promoted_to_spec_id: string | null;
  created_at: string;
}

export type EffortEstimate = "small" | "medium" | "large" | "xlarge";
export type ItemStatus = "pending" | "in_progress" | "completed" | "skipped";
export type ItemCategory =
  | "testing"
  | "types"
  | "architecture"
  | "security"
  | "documentation"
  | "performance";

export interface RemediationItem {
  id: string;
  priority: number;
  category: ItemCategory;
  title: string;
  description: string;
  effort_estimate: EffortEstimate;
  status: ItemStatus;
  feature_id: string | null;
}

export interface RemediationPlan {
  id: string;
  rescue_id: string;
  items: RemediationItem[];
  total_effort_estimate: string;
  created_at: string;
  updated_at: string;
}

// ---- Query keys ----

export const rescueKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "rescue"] as const,
  list: (projectSlug: string) => [...rescueKeys.all(projectSlug), "list"] as const,
  detail: (projectSlug: string, rescueId: string) =>
    [...rescueKeys.all(projectSlug), "detail", rescueId] as const,
  audit: (projectSlug: string, rescueId: string) =>
    [...rescueKeys.all(projectSlug), rescueId, "audit"] as const,
  reverseSpecs: (projectSlug: string, rescueId: string) =>
    [...rescueKeys.all(projectSlug), rescueId, "reverse-specs"] as const,
  remediation: (projectSlug: string, rescueId: string) =>
    [...rescueKeys.all(projectSlug), rescueId, "remediation"] as const,
};

// ---- Hooks ----

export function useRescueProjects(projectSlug: string) {
  return useQuery({
    queryKey: rescueKeys.list(projectSlug),
    queryFn: () => apiFetch<RescueProject[]>(`/hub/projects/${projectSlug}/rescue`),
    enabled: !!projectSlug,
  });
}

export function useRescueProject(projectSlug: string, rescueId: string) {
  return useQuery({
    queryKey: rescueKeys.detail(projectSlug, rescueId),
    queryFn: () => apiFetch<RescueProject>(`/hub/projects/${projectSlug}/rescue/${rescueId}`),
    enabled: !!projectSlug && !!rescueId,
  });
}

export function usePatchRescueProject(projectSlug: string, rescueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { phase?: RescuePhase; name?: string; source_path?: string }) =>
      apiFetch<RescueProject>(`/hub/projects/${projectSlug}/rescue/${rescueId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated: RescueProject) => {
      queryClient.setQueryData(rescueKeys.detail(projectSlug, rescueId), updated);
      queryClient.invalidateQueries({ queryKey: rescueKeys.list(projectSlug) });
    },
  });
}

export function useAudit(projectSlug: string, rescueId: string, enabled = true) {
  return useQuery({
    queryKey: rescueKeys.audit(projectSlug, rescueId),
    queryFn: () => apiFetch<CodebaseAudit>(`/hub/projects/${projectSlug}/rescue/${rescueId}/audit`),
    enabled: !!projectSlug && !!rescueId && enabled,
    retry: false,
  });
}

export function useTriggerAudit(projectSlug: string, rescueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ accepted: boolean; audit_id: string; rescue_id: string }>(
        `/hub/projects/${projectSlug}/rescue/${rescueId}/audit`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rescueKeys.audit(projectSlug, rescueId) });
    },
  });
}

export function useReverseSpecs(projectSlug: string, rescueId: string) {
  return useQuery({
    queryKey: rescueKeys.reverseSpecs(projectSlug, rescueId),
    queryFn: () =>
      apiFetch<ReverseSpec[]>(
        `/hub/projects/${projectSlug}/rescue/${rescueId}/reverse-specs`
      ),
    enabled: !!projectSlug && !!rescueId,
    retry: false,
  });
}

export function useTriggerReverseSpecs(projectSlug: string, rescueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ accepted: boolean; rescue_id: string; reverse_specs_queued: number }>(
        `/hub/projects/${projectSlug}/rescue/${rescueId}/reverse-specs`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rescueKeys.reverseSpecs(projectSlug, rescueId),
      });
    },
  });
}

export function usePromoteReverseSpec(projectSlug: string, rescueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reverseSpecId: string) =>
      apiFetch<{ reverse_spec: ReverseSpec; spec: unknown }>(
        `/hub/projects/${projectSlug}/rescue/${rescueId}/reverse-specs/${reverseSpecId}/promote`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rescueKeys.reverseSpecs(projectSlug, rescueId),
      });
    },
  });
}

export function useRemediationPlan(projectSlug: string, rescueId: string) {
  return useQuery({
    queryKey: rescueKeys.remediation(projectSlug, rescueId),
    queryFn: () =>
      apiFetch<RemediationPlan>(
        `/hub/projects/${projectSlug}/rescue/${rescueId}/remediation`
      ),
    enabled: !!projectSlug && !!rescueId,
    retry: false,
  });
}

export function useTriggerRemediation(projectSlug: string, rescueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ accepted: boolean; plan_id: string; rescue_id: string; items_count: number }>(
        `/hub/projects/${projectSlug}/rescue/${rescueId}/remediation`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rescueKeys.remediation(projectSlug, rescueId),
      });
    },
  });
}

export function useGenerateFeatures(projectSlug: string, rescueId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ features_created: number; feature_ids: string[]; plan: RemediationPlan }>(
        `/hub/projects/${projectSlug}/rescue/${rescueId}/remediation/generate-features`,
        { method: "POST" }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: rescueKeys.remediation(projectSlug, rescueId),
      });
    },
  });
}

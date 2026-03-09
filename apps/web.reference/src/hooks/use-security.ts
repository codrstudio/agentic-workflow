import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SecurityGateConfig {
  project_id: string;
  enabled: boolean;
  block_on_critical: boolean;
  block_on_high: boolean;
  block_on_medium: boolean;
  auto_scan_on_review: boolean;
  scan_model: string;
  updated_at: string;
}

export interface SecurityFinding {
  id: string;
  project_id: string;
  scan_id: string;
  feature_id: string | null;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  description: string;
  file_path: string | null;
  line_number: number | null;
  suggested_fix: string | null;
  resolution: "open" | "fixed" | "accepted_risk" | "false_positive";
  resolution_note: string | null;
  resolved_at: string | null;
  created_at: string;
}

export interface WeeklyFindingEntry {
  week: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

export interface SecurityScorecard {
  score: number;
  open_count: number;
  critical_high_count: number;
  avg_resolution_hours: number | null;
  counts: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  weekly_findings: WeeklyFindingEntry[];
  open_critical_high: SecurityFinding[];
}

const keys = {
  scorecard: (slug: string) => ["security", slug, "scorecard"] as const,
  config: (slug: string) => ["security", slug, "config"] as const,
  findings: (slug: string) => ["security", slug, "findings"] as const,
};

export function useSecurityScorecard(projectSlug: string) {
  return useQuery({
    queryKey: keys.scorecard(projectSlug),
    queryFn: () => apiFetch<SecurityScorecard>(`/hub/projects/${projectSlug}/security/scorecard`),
  });
}

export function useSecurityGateConfig(projectSlug: string) {
  return useQuery({
    queryKey: keys.config(projectSlug),
    queryFn: () => apiFetch<SecurityGateConfig>(`/hub/projects/${projectSlug}/security/gate-config`),
  });
}

export function useUpdateSecurityGateConfig(projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<SecurityGateConfig, "project_id" | "updated_at">>) =>
      apiFetch<SecurityGateConfig>(`/hub/projects/${projectSlug}/security/gate-config`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.config(projectSlug) }),
  });
}

export function useSecurityFindings(projectSlug: string, params?: { resolution?: string; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.resolution) query.set("resolution", params.resolution);
  if (params?.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return useQuery({
    queryKey: [...keys.findings(projectSlug), params],
    queryFn: () =>
      apiFetch<SecurityFinding[]>(`/hub/projects/${projectSlug}/security/findings${qs ? `?${qs}` : ""}`),
  });
}

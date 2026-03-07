import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type GateTransition =
  | "brainstorming_to_specs"
  | "specs_to_prps"
  | "prps_to_features";

export type GateStatus = "passing" | "failing" | "not_evaluated" | "overridden";

export interface CheckResult {
  id: string;
  description: string;
  check_type: string;
  target: string;
  threshold?: number;
  passed: boolean;
  details?: string;
}

export interface QualityGate {
  transition: GateTransition;
  status: "passing" | "failing" | "not_evaluated";
  checks?: CheckResult[];
  evaluated_at?: string;
  overridden?: boolean;
  override_reason?: string;
  overridden_at?: string;
}

export function resolveGateStatus(gate: QualityGate): GateStatus {
  if (gate.overridden) return "overridden";
  return gate.status;
}

export const qualityGateKeys = {
  all: (slug: string) => ["quality-gates", slug] as const,
  list: (slug: string, sprint: number) =>
    [...qualityGateKeys.all(slug), "list", sprint] as const,
};

export function useQualityGates(projectSlug: string, sprintNumber: number) {
  return useQuery({
    queryKey: qualityGateKeys.list(projectSlug, sprintNumber),
    queryFn: () =>
      apiFetch<QualityGate[]>(
        `/hub/projects/${projectSlug}/sprints/${sprintNumber}/gates`
      ),
    enabled: sprintNumber > 0,
  });
}

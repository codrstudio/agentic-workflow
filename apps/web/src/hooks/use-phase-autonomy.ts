import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type AutonomyLevel =
  | "full_auto"
  | "auto_with_review"
  | "approval_required"
  | "manual_only";

export type EscalationAction = "notify" | "block" | "fallback_manual";

export type PipelinePhase =
  | "brainstorming"
  | "specs"
  | "prps"
  | "implementation"
  | "review"
  | "merge";

export interface PhaseAutonomyConfig {
  phase: PipelinePhase;
  autonomy_level: AutonomyLevel;
  confidence_threshold: number;
  require_sign_off: boolean;
  max_auto_retries: number;
  escalation_action: EscalationAction;
  updated_at: string;
}

export interface PhasesResponse {
  phases: PhaseAutonomyConfig[];
}

export const phaseAutonomyKeys = {
  all: (slug: string) => ["phase-autonomy", slug] as const,
  phases: (slug: string) => [...phaseAutonomyKeys.all(slug), "phases"] as const,
};

export function usePhaseAutonomyConfigs(slug: string) {
  return useQuery({
    queryKey: phaseAutonomyKeys.phases(slug),
    queryFn: () =>
      apiFetch<PhasesResponse>(`/hub/projects/${slug}/autonomy/phases`),
  });
}

export function usePatchPhaseAutonomy(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      phase: PipelinePhase;
      autonomy_level?: AutonomyLevel;
      confidence_threshold?: number;
      require_sign_off?: boolean;
      max_auto_retries?: number;
      escalation_action?: EscalationAction;
    }) =>
      apiFetch<PhaseAutonomyConfig>(
        `/hub/projects/${slug}/autonomy/phases`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: phaseAutonomyKeys.phases(slug),
      });
    },
  });
}

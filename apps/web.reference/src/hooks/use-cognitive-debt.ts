import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// ---- Types ----

export type AutoDetectedRisk = "low" | "medium" | "high";
export type ComprehensionGateType =
  | "summary_required"
  | "diff_review"
  | "intent_confirmation"
  | "scope_check";

export interface ComprehensionGate {
  id: string;
  project_id: string;
  session_id: string | null;
  phase: string;
  type: ComprehensionGateType;
  prompt: string;
  response: string | null;
  cognitive_load_score: number | null;
  auto_detected_risk: AutoDetectedRisk;
  completed: boolean;
  bypassed: boolean;
  created_at: string;
  completed_at: string | null;
}

export interface CognitiveDebtIndicator {
  project_id: string;
  computed_at: string;
  period: { from: string; to: string };
  total_gates: number;
  completed_gates: number;
  bypassed_gates: number;
  completion_rate: number;
  avg_cognitive_load: number | null;
  high_risk_phases: string[];
  generation_rate_lines_per_min: number;
  review_rate_lines_per_min: number;
  comprehension_gap_ratio: number;
}

export interface PatchGateBody {
  response?: string;
  cognitive_load_score?: number;
  completed?: boolean;
  bypassed?: boolean;
  completed_at?: string;
}

// ---- Query keys ----

export const cognitiveDebtKeys = {
  gates: (projectId: string) => ["cognitive-debt", "gates", projectId] as const,
  indicators: (projectId: string) =>
    ["cognitive-debt", "indicators", projectId] as const,
};

// ---- Hooks ----

export function useCognitiveDebtGates(
  projectId: string,
  params?: { phase?: string; completed?: boolean },
) {
  const searchParams = new URLSearchParams();
  if (params?.phase) searchParams.set("phase", params.phase);
  if (params?.completed !== undefined)
    searchParams.set("completed", String(params.completed));
  const qs = searchParams.toString();

  return useQuery({
    queryKey: [...cognitiveDebtKeys.gates(projectId), params],
    queryFn: () =>
      apiFetch<ComprehensionGate[]>(
        `/hub/projects/${projectId}/cognitive-debt/gates${qs ? `?${qs}` : ""}`,
      ),
    enabled: !!projectId,
  });
}

export function usePatchCognitiveDebtGate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ gateId, body }: { gateId: string; body: PatchGateBody }) =>
      apiFetch<ComprehensionGate>(
        `/hub/projects/${projectId}/cognitive-debt/gates/${gateId}`,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: cognitiveDebtKeys.gates(projectId),
      });
      queryClient.invalidateQueries({
        queryKey: cognitiveDebtKeys.indicators(projectId),
      });
    },
  });
}

export function useCognitiveDebtIndicators(projectId: string) {
  return useQuery({
    queryKey: cognitiveDebtKeys.indicators(projectId),
    queryFn: () =>
      apiFetch<CognitiveDebtIndicator>(
        `/hub/projects/${projectId}/cognitive-debt/indicators`,
      ),
    enabled: !!projectId,
  });
}

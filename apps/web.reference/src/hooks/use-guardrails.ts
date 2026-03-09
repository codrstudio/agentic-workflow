import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface WorkGuardrails {
  session_duration_limit: number;
  daily_active_limit: number;
  break_reminder_interval: number;
  late_hour_threshold: number;
  weekend_alerts_enabled: boolean;
  context_switch_warning_threshold: number;
}

export const GUARDRAILS_DEFAULTS: WorkGuardrails = {
  session_duration_limit: 120,
  daily_active_limit: 480,
  break_reminder_interval: 45,
  late_hour_threshold: 22,
  weekend_alerts_enabled: true,
  context_switch_warning_threshold: 5,
};

export const guardrailsKeys = {
  all: (slug: string) => ["guardrails", slug] as const,
  detail: (slug: string) => [...guardrailsKeys.all(slug), "detail"] as const,
};

export function useGuardrails(projectSlug: string) {
  return useQuery({
    queryKey: guardrailsKeys.detail(projectSlug),
    queryFn: () =>
      apiFetch<WorkGuardrails>(
        `/hub/projects/${projectSlug}/burnout/guardrails`
      ),
  });
}

export function useUpdateGuardrails(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Partial<WorkGuardrails>) =>
      apiFetch<WorkGuardrails>(
        `/hub/projects/${projectSlug}/burnout/guardrails`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        }
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(guardrailsKeys.detail(projectSlug), data);
    },
  });
}

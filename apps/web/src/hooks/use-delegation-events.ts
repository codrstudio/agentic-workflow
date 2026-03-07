import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PipelinePhase } from "./use-phase-autonomy";

export type DelegationEventType =
  | "auto_executed"
  | "review_requested"
  | "approval_granted"
  | "approval_denied"
  | "escalated"
  | "sign_off_completed";

export interface DelegationEvent {
  id: string;
  project_id: string;
  phase: PipelinePhase;
  event_type: DelegationEventType;
  agent_confidence: number;
  details?: string;
  created_at: string;
}

export interface DelegationEventsResponse {
  events: DelegationEvent[];
}

export const delegationEventKeys = {
  all: (slug: string) => ["delegation-events", slug] as const,
  list: (slug: string, filters?: Record<string, string>) =>
    [...delegationEventKeys.all(slug), "list", filters] as const,
};

export function useDelegationEvents(
  slug: string,
  filters?: { phase?: string; event_type?: string; from?: string; limit?: number }
) {
  const params = new URLSearchParams();
  if (filters?.phase) params.set("phase", filters.phase);
  if (filters?.event_type) params.set("event_type", filters.event_type);
  if (filters?.from) params.set("from", filters.from);
  if (filters?.limit) params.set("limit", String(filters.limit));
  const qs = params.toString();

  return useQuery({
    queryKey: delegationEventKeys.list(slug, Object.fromEntries(params)),
    queryFn: () =>
      apiFetch<DelegationEventsResponse>(
        `/hub/projects/${slug}/autonomy/events${qs ? `?${qs}` : ""}`
      ),
  });
}

export function useCreateDelegationEvent(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      phase: PipelinePhase;
      event_type: DelegationEventType;
      agent_confidence: number;
      details?: string;
    }) =>
      apiFetch<DelegationEvent>(
        `/hub/projects/${slug}/autonomy/events`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: delegationEventKeys.all(slug),
      });
    },
  });
}

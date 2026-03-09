import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type HandoffStatus =
  | "draft"
  | "generating_spec"
  | "spec_ready"
  | "generating_prp"
  | "prp_ready"
  | "enqueued"
  | "cancelled";

export type HandoffSourceType =
  | "chat_session"
  | "artifact"
  | "source_file"
  | "free_text";

export interface HandoffRequest {
  id: string;
  project_id: string;
  title: string;
  source_type: HandoffSourceType;
  source_ref: string | null;
  description: string;
  status: HandoffStatus;
  generated_spec_id: string | null;
  generated_prp_id: string | null;
  feature_id: string | null;
  spec_approved: boolean;
  prp_approved: boolean;
  pm_notes: string | null;
  created_at: string;
  updated_at: string;
}

export const handoffKeys = {
  all: (projectSlug: string) =>
    ["projects", projectSlug, "handoff-requests"] as const,
  list: (projectSlug: string, filters?: Record<string, string>) =>
    [...handoffKeys.all(projectSlug), "list", filters ?? {}] as const,
  detail: (projectSlug: string, id: string) =>
    [...handoffKeys.all(projectSlug), "detail", id] as const,
};

export function useHandoffRequests(
  projectSlug: string,
  filters?: { status?: string },
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  const qs = params.toString();

  return useQuery({
    queryKey: handoffKeys.list(projectSlug, filters as Record<string, string>),
    queryFn: () =>
      apiFetch<HandoffRequest[]>(
        `/hub/projects/${projectSlug}/handoff-requests${qs ? `?${qs}` : ""}`,
      ),
  });
}

export function useHandoffRequest(projectSlug: string, requestId: string | null) {
  return useQuery({
    queryKey: handoffKeys.detail(projectSlug, requestId ?? ""),
    queryFn: () =>
      apiFetch<HandoffRequest>(
        `/hub/projects/${projectSlug}/handoff-requests/${requestId}`,
      ),
    enabled: !!requestId,
  });
}

export function usePatchHandoffRequest(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id: string;
      title?: string;
      description?: string;
      pm_notes?: string | null;
      spec_approved?: boolean;
      prp_approved?: boolean;
    }) => {
      const { id, ...body } = params;
      return apiFetch<HandoffRequest>(
        `/hub/projects/${projectSlug}/handoff-requests/${id}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoffKeys.all(projectSlug) });
    },
  });
}

export function useCreateHandoffRequest(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      source_type: HandoffSourceType;
      source_ref?: string | null;
      description: string;
      pm_notes?: string | null;
    }) =>
      apiFetch<HandoffRequest>(
        `/hub/projects/${projectSlug}/handoff-requests`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoffKeys.all(projectSlug) });
    },
  });
}

export function useGenerateSpec(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      apiFetch<{ job_id: string; request_id: string; status: string }>(
        `/hub/projects/${projectSlug}/handoff-requests/${requestId}/generate-spec`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoffKeys.all(projectSlug) });
    },
  });
}

export function useGeneratePrp(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) =>
      apiFetch<{ job_id: string; request_id: string; status: string }>(
        `/hub/projects/${projectSlug}/handoff-requests/${requestId}/generate-prp`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoffKeys.all(projectSlug) });
    },
  });
}

export function useEnqueueFeature(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      requestId: string;
      sprint: number;
      priority?: "high" | "medium" | "low";
    }) =>
      apiFetch<{ feature_id: string; handoff_request: HandoffRequest }>(
        `/hub/projects/${projectSlug}/handoff-requests/${params.requestId}/enqueue`,
        {
          method: "POST",
          body: JSON.stringify({ sprint: params.sprint, priority: params.priority }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoffKeys.all(projectSlug) });
    },
  });
}

export function useCancelHandoffRequest(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(
        `/hub/projects/${projectSlug}/handoff-requests/${id}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: handoffKeys.all(projectSlug) });
    },
  });
}

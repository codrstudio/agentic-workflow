import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ContextProfile {
  id: string;
  project_id: string;
  name: string;
  description?: string;
  source_ids: string[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const profileKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "context-profiles"] as const,
  list: (projectSlug: string) => [...profileKeys.all(projectSlug), "list"] as const,
};

export function useContextProfiles(projectSlug: string) {
  return useQuery({
    queryKey: profileKeys.list(projectSlug),
    queryFn: () => apiFetch<ContextProfile[]>(`/hub/projects/${projectSlug}/context-profiles`),
  });
}

export function useCreateProfile(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      source_ids: string[];
      is_default?: boolean;
    }) =>
      apiFetch<ContextProfile>(`/hub/projects/${projectSlug}/context-profiles`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all(projectSlug) });
    },
  });
}

export function useUpdateProfile(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      name?: string;
      description?: string;
      source_ids?: string[];
      is_default?: boolean;
    }) =>
      apiFetch<ContextProfile>(`/hub/projects/${projectSlug}/context-profiles/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all(projectSlug) });
    },
  });
}

export function useDeleteProfile(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/hub/projects/${projectSlug}/context-profiles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileKeys.all(projectSlug) });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Source {
  id: string;
  project_id: string;
  name: string;
  type: "markdown" | "text" | "pdf" | "url" | "code";
  content?: string;
  file_path?: string;
  url?: string;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  tags: string[];
}

export const sourceKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "sources"] as const,
  list: (projectSlug: string) => [...sourceKeys.all(projectSlug), "list"] as const,
  detail: (projectSlug: string, id: string) =>
    [...sourceKeys.all(projectSlug), "detail", id] as const,
};

export function useSources(projectSlug: string) {
  return useQuery({
    queryKey: sourceKeys.list(projectSlug),
    queryFn: () => apiFetch<Source[]>(`/hub/projects/${projectSlug}/sources`),
  });
}

export function useCreateSource(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      type: Source["type"];
      content?: string;
      url?: string;
      tags?: string[];
    }) =>
      apiFetch<Source>(`/hub/projects/${projectSlug}/sources`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sourceKeys.all(projectSlug) });
    },
  });
}

export function useDeleteSource(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/hub/projects/${projectSlug}/sources/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sourceKeys.all(projectSlug) });
    },
  });
}

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ArtifactType = "document" | "code" | "json" | "diagram" | "config";
export type ArtifactOrigin = "chat" | "harness" | "manual";

export interface Artifact {
  id: string;
  project_id: string;
  name: string;
  type: ArtifactType;
  origin: ArtifactOrigin;
  content?: string;
  file_path?: string;
  session_id?: string;
  step_ref?: string;
  version: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const artifactKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "artifacts"] as const,
  list: (projectSlug: string) =>
    [...artifactKeys.all(projectSlug), "list"] as const,
  detail: (projectSlug: string, id: string) =>
    [...artifactKeys.all(projectSlug), "detail", id] as const,
};

export function useArtifacts(projectSlug: string) {
  return useQuery({
    queryKey: artifactKeys.list(projectSlug),
    queryFn: () =>
      apiFetch<Artifact[]>(`/hub/projects/${projectSlug}/artifacts`),
  });
}

export function useArtifact(projectSlug: string, id: string | null) {
  return useQuery({
    queryKey: artifactKeys.detail(projectSlug, id ?? ""),
    queryFn: () =>
      apiFetch<Artifact>(`/hub/projects/${projectSlug}/artifacts/${id}`),
    enabled: !!id,
  });
}

export function useCreateArtifact(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      type: ArtifactType;
      content: string;
      origin?: ArtifactOrigin;
      tags?: string[];
    }) =>
      apiFetch<Artifact>(`/hub/projects/${projectSlug}/artifacts`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: artifactKeys.all(projectSlug),
      });
    },
  });
}

export function useDeleteArtifact(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/hub/projects/${projectSlug}/artifacts/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: artifactKeys.all(projectSlug),
      });
    },
  });
}

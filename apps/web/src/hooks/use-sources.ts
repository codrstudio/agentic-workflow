import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type SourceCategory = "general" | "frontend" | "backend" | "business" | "reference" | "config";

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
  category: SourceCategory;
  pinned: boolean;
  auto_include: boolean;
  relevance_tags: string[];
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

export function useSource(projectSlug: string, id: string | null) {
  return useQuery({
    queryKey: sourceKeys.detail(projectSlug, id ?? ""),
    queryFn: () => apiFetch<Source>(`/hub/projects/${projectSlug}/sources/${id}`),
    enabled: !!id,
  });
}

export function useUpdateSource(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: {
      id: string;
      name?: string;
      content?: string;
      tags?: string[];
      category?: SourceCategory;
      pinned?: boolean;
      auto_include?: boolean;
      relevance_tags?: string[];
    }) =>
      apiFetch<Source>(`/hub/projects/${projectSlug}/sources/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: sourceKeys.all(projectSlug) });
      queryClient.invalidateQueries({ queryKey: sourceKeys.detail(projectSlug, variables.id) });
    },
  });
}

export function useUploadSource(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      fetch(`/api/v1/hub/projects/${projectSlug}/sources/upload`, {
        method: "POST",
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Upload failed: ${res.status}`);
        }
        return res.json() as Promise<Source>;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sourceKeys.all(projectSlug) });
    },
  });
}

export interface RecommendedSource {
  source_id: string;
  name: string;
  relevance: number;
  reason: string;
}

export const recommendedSourceKeys = {
  all: (projectSlug: string, sessionId: string) =>
    ["projects", projectSlug, "sessions", sessionId, "recommended-sources"] as const,
};

export function useRecommendedSources(projectSlug: string, sessionId: string | null) {
  return useQuery({
    queryKey: recommendedSourceKeys.all(projectSlug, sessionId ?? ""),
    queryFn: () =>
      apiFetch<{ sources: RecommendedSource[] }>(
        `/hub/projects/${projectSlug}/sessions/${sessionId}/recommended-sources`
      ).then((res) => res.sources),
    enabled: !!sessionId,
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

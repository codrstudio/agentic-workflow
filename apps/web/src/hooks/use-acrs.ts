import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ACRStatus = "active" | "superseded" | "deprecated";
export type ACRCategory =
  | "structure"
  | "pattern"
  | "dependency"
  | "technology"
  | "security"
  | "performance"
  | "convention"
  | "other";

export type ACRViolationResolution = "open" | "accepted" | "fixed" | "wontfix";
export type ACRViolationContext = "review" | "manual" | "import";

export interface ACR {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  category: ACRCategory;
  status: ACRStatus;
  constraint: string;
  rationale: string;
  examples?: {
    compliant?: string;
    non_compliant?: string;
  };
  superseded_by: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ACRViolation {
  id: string;
  project_id: string;
  acr_id: string;
  acr_slug: string;
  detected_at: string;
  context: ACRViolationContext;
  description: string;
  artifact_id: string | null;
  feature_id: string | null;
  resolution: ACRViolationResolution;
  resolution_note?: string;
  resolved_at: string | null;
}

export const acrKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "acrs"] as const,
  list: (projectSlug: string, filters?: Record<string, string>) =>
    [...acrKeys.all(projectSlug), "list", filters ?? {}] as const,
  detail: (projectSlug: string, id: string) =>
    [...acrKeys.all(projectSlug), "detail", id] as const,
  violations: (projectSlug: string, acrId: string) =>
    [...acrKeys.all(projectSlug), "violations", acrId] as const,
};

export function useACRs(
  projectSlug: string,
  filters?: { status?: string; category?: string },
) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.category) params.set("category", filters.category);
  const qs = params.toString();

  return useQuery({
    queryKey: acrKeys.list(projectSlug, filters as Record<string, string>),
    queryFn: () =>
      apiFetch<ACR[]>(
        `/hub/projects/${projectSlug}/acrs${qs ? `?${qs}` : ""}`,
      ),
  });
}

export function useACR(projectSlug: string, acrId: string | null) {
  return useQuery({
    queryKey: acrKeys.detail(projectSlug, acrId ?? ""),
    queryFn: () =>
      apiFetch<ACR>(`/hub/projects/${projectSlug}/acrs/${acrId}`),
    enabled: !!acrId,
  });
}

export function useACRViolations(projectSlug: string, acrId: string | null) {
  return useQuery({
    queryKey: acrKeys.violations(projectSlug, acrId ?? ""),
    queryFn: () =>
      apiFetch<ACRViolation[]>(
        `/hub/projects/${projectSlug}/acrs/${acrId}/violations`,
      ),
    enabled: !!acrId,
  });
}

export function usePatchACR(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string } & Partial<Omit<ACR, "id" | "slug" | "project_id" | "created_at" | "updated_at">>) => {
      const { id, ...body } = params;
      return apiFetch<ACR>(`/hub/projects/${projectSlug}/acrs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acrKeys.all(projectSlug) });
    },
  });
}

export function useDeprecateACR(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ACR>(`/hub/projects/${projectSlug}/acrs/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: acrKeys.all(projectSlug) });
    },
  });
}

export function useCreateViolation(projectSlug: string, acrId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      context: ACRViolationContext;
      description: string;
      artifact_id?: string | null;
      feature_id?: string | null;
    }) =>
      apiFetch<ACRViolation>(
        `/hub/projects/${projectSlug}/acrs/${acrId}/violations`,
        { method: "POST", body: JSON.stringify(body) },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: acrKeys.violations(projectSlug, acrId),
      });
    },
  });
}

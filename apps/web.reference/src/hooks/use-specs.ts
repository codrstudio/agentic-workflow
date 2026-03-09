import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type SpecStatus =
  | "draft"
  | "review"
  | "approved"
  | "implementing"
  | "completed"
  | "superseded";

export type ReviewVerdict = "approve" | "request_changes" | "reject";
export type CommentSeverity = "blocker" | "suggestion" | "praise";

export interface SpecSection {
  title: string;
  anchor: string;
  content: string;
}

export interface SpecDocument {
  id: string;
  project_id: string;
  slug: string;
  title: string;
  status: SpecStatus;
  version: number;
  content_md: string;
  sections: SpecSection[];
  discoveries: string[];
  derived_features: string[];
  review_score: number | null;
  reviewed_by: string[];
  superseded_by: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ReviewComment {
  section_anchor: string;
  comment: string;
  severity: CommentSeverity;
}

export interface SpecReviewResult {
  id: string;
  project_id: string;
  spec_id: string;
  reviewer: string;
  score: number;
  verdict: ReviewVerdict;
  comments: ReviewComment[];
  created_at: string;
}

export const specKeys = {
  all: (projectSlug: string) => ["projects", projectSlug, "specs"] as const,
  list: (projectSlug: string, filters?: Record<string, string>) =>
    [...specKeys.all(projectSlug), "list", filters ?? {}] as const,
  detail: (projectSlug: string, id: string) =>
    [...specKeys.all(projectSlug), "detail", id] as const,
  reviews: (projectSlug: string, specId: string) =>
    [...specKeys.all(projectSlug), "reviews", specId] as const,
};

export function useSpecs(projectSlug: string, filters?: { status?: string }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  const query = params.toString();

  return useQuery({
    queryKey: specKeys.list(projectSlug, filters as Record<string, string>),
    queryFn: () =>
      apiFetch<SpecDocument[]>(
        `/hub/projects/${projectSlug}/specs${query ? `?${query}` : ""}`,
      ),
    enabled: !!projectSlug,
  });
}

export function useSpec(projectSlug: string, specId: string) {
  return useQuery({
    queryKey: specKeys.detail(projectSlug, specId),
    queryFn: () =>
      apiFetch<SpecDocument>(`/hub/projects/${projectSlug}/specs/${specId}`),
    enabled: !!projectSlug && !!specId,
  });
}

export function useSpecReviews(projectSlug: string, specId: string) {
  return useQuery({
    queryKey: specKeys.reviews(projectSlug, specId),
    queryFn: () =>
      apiFetch<SpecReviewResult[]>(
        `/hub/projects/${projectSlug}/specs/${specId}/reviews`,
      ),
    enabled: !!projectSlug && !!specId,
  });
}

export function useTriggerSpecReview(projectSlug: string, specId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agents?: string[]) =>
      apiFetch<{ accepted: boolean; reviews_queued: number }>(
        `/hub/projects/${projectSlug}/specs/${specId}/trigger-review`,
        {
          method: "POST",
          body: JSON.stringify({ agents: agents ?? ["reviewer"] }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: specKeys.reviews(projectSlug, specId),
      });
      queryClient.invalidateQueries({
        queryKey: specKeys.detail(projectSlug, specId),
      });
    },
  });
}

export function usePatchSpec(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: Partial<SpecDocument> & { id: string }) =>
      apiFetch<SpecDocument>(`/hub/projects/${projectSlug}/specs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: (updated: SpecDocument) => {
      queryClient.invalidateQueries({ queryKey: specKeys.all(projectSlug) });
      queryClient.setQueryData(
        specKeys.detail(projectSlug, updated.id),
        updated,
      );
    },
  });
}

export function useCreateSpec(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; content_md?: string; tags?: string[] }) =>
      apiFetch<SpecDocument>(`/hub/projects/${projectSlug}/specs`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: specKeys.all(projectSlug) });
    },
  });
}

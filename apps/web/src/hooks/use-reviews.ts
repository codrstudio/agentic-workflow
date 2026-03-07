import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ReviewSummary {
  id: string;
  project_id: string;
  title: string;
  status: "pending" | "in_review" | "approved" | "changes_requested";
  chat_session_id?: string;
  step_ref?: string;
  items_count: number;
  items_pending: number;
  criteria_count: number;
  criteria_checked: number;
  created_at: string;
  updated_at: string;
}

export interface ReviewDetail {
  id: string;
  project_id: string;
  title: string;
  status: "pending" | "in_review" | "approved" | "changes_requested";
  chat_session_id?: string;
  step_ref?: string;
  items: Array<{
    id: string;
    file_path: string;
    diff_type: "added" | "modified" | "deleted";
    status: "pending" | "approved" | "flagged";
    comment?: string;
  }>;
  criteria: Array<{
    id: string;
    label: string;
    checked: boolean;
  }>;
  created_at: string;
  updated_at: string;
}

export interface ItemDiff {
  item_id: string;
  file_path: string;
  diff_type: "added" | "modified" | "deleted";
  before: string;
  after: string;
  unified_diff: string;
}

export const reviewKeys = {
  all: (projectSlug: string) =>
    ["projects", projectSlug, "reviews"] as const,
  list: (projectSlug: string) =>
    [...reviewKeys.all(projectSlug), "list"] as const,
  detail: (projectSlug: string, reviewId: string) =>
    [...reviewKeys.all(projectSlug), reviewId] as const,
  itemDiff: (projectSlug: string, reviewId: string, itemId: string) =>
    [...reviewKeys.all(projectSlug), reviewId, "items", itemId, "diff"] as const,
};

export function useReviews(projectSlug: string, status?: string) {
  return useQuery({
    queryKey: [...reviewKeys.list(projectSlug), status ?? "all"] as const,
    queryFn: () => {
      const params = status ? `?status=${status}` : "";
      return apiFetch<ReviewSummary[]>(
        `/hub/projects/${projectSlug}/reviews${params}`
      );
    },
  });
}

export function useReviewDetail(projectSlug: string, reviewId: string) {
  return useQuery({
    queryKey: reviewKeys.detail(projectSlug, reviewId),
    queryFn: () =>
      apiFetch<ReviewDetail>(
        `/hub/projects/${projectSlug}/reviews/${reviewId}`
      ),
    enabled: !!reviewId,
  });
}

export function useItemDiff(
  projectSlug: string,
  reviewId: string,
  itemId: string | null
) {
  return useQuery({
    queryKey: reviewKeys.itemDiff(projectSlug, reviewId, itemId ?? ""),
    queryFn: () =>
      apiFetch<ItemDiff>(
        `/hub/projects/${projectSlug}/reviews/${reviewId}/items/${itemId}/diff`
      ),
    enabled: !!itemId,
  });
}

export function useUpdateItemStatus(projectSlug: string, reviewId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      itemId: string;
      status: "approved" | "flagged";
      comment?: string;
    }) =>
      apiFetch(
        `/hub/projects/${projectSlug}/reviews/${reviewId}/items/${body.itemId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ status: body.status, comment: body.comment }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.detail(projectSlug, reviewId),
      });
    },
  });
}

export function useCreateReview(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      title: string;
      chat_session_id?: string;
      step_ref?: string;
    }) =>
      apiFetch<ReviewDetail>(`/hub/projects/${projectSlug}/reviews`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reviewKeys.all(projectSlug),
      });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SnapshotSession {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
  key_topics: string[];
}

export interface SnapshotArtifact {
  id: string;
  title: string;
  type: string;
  updated_at: string;
}

export interface SnapshotActiveSprint {
  number: number;
  current_phase: string;
  features_total: number;
  features_passing: number;
  features_failing: number;
  features_pending: number;
}

export interface SnapshotReview {
  id: string;
  title: string;
  status: string;
  items_count: number;
}

export interface ProjectSnapshot {
  id: string;
  project_id: string;
  created_at: string;
  summary: string;
  recent_sessions: SnapshotSession[];
  recent_artifacts: SnapshotArtifact[];
  active_sprint?: SnapshotActiveSprint;
  pending_reviews: SnapshotReview[];
  open_decisions: string[];
}

export const snapshotKeys = {
  all: (slug: string) => ["snapshots", slug] as const,
  latest: (slug: string) => [...snapshotKeys.all(slug), "latest"] as const,
};

export function useLatestSnapshot(projectSlug: string) {
  return useQuery({
    queryKey: snapshotKeys.latest(projectSlug),
    queryFn: () =>
      apiFetch<ProjectSnapshot>(
        `/hub/projects/${projectSlug}/snapshots/latest`,
      ),
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
}

export function useGenerateSnapshot(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<ProjectSnapshot>(
        `/hub/projects/${projectSlug}/snapshots`,
        { method: "POST" },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: snapshotKeys.latest(projectSlug),
      });
    },
  });
}

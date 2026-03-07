import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface SprintSummary {
  number: number;
  phases: Record<string, number>;
  features_count: number;
}

export interface SprintDetail {
  number: number;
  phases: Record<string, string[]>;
  has_features: boolean;
}

export const sprintKeys = {
  all: (slug: string) => ["sprints", slug] as const,
  list: (slug: string) => [...sprintKeys.all(slug), "list"] as const,
  detail: (slug: string, num: number) =>
    [...sprintKeys.all(slug), "detail", num] as const,
};

export function useSprints(projectSlug: string) {
  return useQuery({
    queryKey: sprintKeys.list(projectSlug),
    queryFn: () =>
      apiFetch<SprintSummary[]>(`/hub/projects/${projectSlug}/sprints`),
  });
}

export function useSprintDetail(projectSlug: string, sprintNumber: number) {
  return useQuery({
    queryKey: sprintKeys.detail(projectSlug, sprintNumber),
    queryFn: () =>
      apiFetch<SprintDetail>(
        `/hub/projects/${projectSlug}/sprints/${sprintNumber}`
      ),
    enabled: sprintNumber > 0,
  });
}

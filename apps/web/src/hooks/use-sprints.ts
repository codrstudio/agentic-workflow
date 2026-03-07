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

export interface SprintFile {
  filename: string;
  phase: string;
  sprint: number;
  content: string;
  type: "markdown" | "json" | "text";
}

export function useSprintFile(
  projectSlug: string,
  sprintNumber: number,
  phase: string,
  filename: string
) {
  return useQuery({
    queryKey: [...sprintKeys.detail(projectSlug, sprintNumber), "file", phase, filename] as const,
    queryFn: () =>
      apiFetch<SprintFile>(
        `/hub/projects/${projectSlug}/sprints/${sprintNumber}/files/${phase}/${filename}`
      ),
    enabled: sprintNumber > 0 && !!phase && !!filename,
  });
}

export interface SprintFeature {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  dependencies: string[];
  tests: string[];
  completed_at?: string;
  prp_path?: string;
  attempts?: number;
}

export function useSprintFeatures(projectSlug: string, sprintNumber: number) {
  return useQuery({
    queryKey: [...sprintKeys.detail(projectSlug, sprintNumber), "features"] as const,
    queryFn: () =>
      apiFetch<SprintFeature[]>(
        `/hub/projects/${projectSlug}/sprints/${sprintNumber}/features`
      ),
    enabled: sprintNumber > 0,
  });
}

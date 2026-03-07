import { useQuery, useQueries } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Project } from "@/hooks/use-projects";

export interface StepInfo {
  number: number;
  name: string;
  type: string;
  task: string;
  agent: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  started_at?: string;
  finished_at?: string;
  exit_code?: number | null;
  duration_ms?: number | null;
}

export interface WaveInfo {
  number: number;
  steps: StepInfo[];
  status: "running" | "completed" | "failed" | "idle";
}

export interface WorkspaceStatus {
  project: string;
  waves: WaveInfo[];
  current_wave: number | null;
  status: "running" | "completed" | "failed" | "idle";
}

export const harnessKeys = {
  all: ["harness"] as const,
  status: (slug: string) => [...harnessKeys.all, "status", slug] as const,
};

export function useHarnessStatus(slug: string) {
  return useQuery({
    queryKey: harnessKeys.status(slug),
    queryFn: () =>
      apiFetch<WorkspaceStatus>(`/hub/projects/${slug}/harness/status`),
    retry: false,
  });
}

export function useAllHarnessStatuses(projects: Project[] | undefined) {
  return useQueries({
    queries: (projects ?? []).map((project) => ({
      queryKey: harnessKeys.status(project.slug),
      queryFn: () =>
        apiFetch<WorkspaceStatus>(
          `/hub/projects/${project.slug}/harness/status`
        ),
      retry: false,
    })),
  });
}

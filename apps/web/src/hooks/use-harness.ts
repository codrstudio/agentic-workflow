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

export interface LoopMeta {
  status: string;
  iteration: number;
  total: number;
  done: number;
  remaining: number;
  features_done: number;
  started_at?: string;
  updated_at?: string;
  max_iterations?: number | null;
  max_features?: number | null;
  exit_reason?: string;
}

export interface StepDetail {
  wave: number;
  step: number;
  name: string;
  type: string;
  task: string;
  agent: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  exit_code: number | null;
  pid: number | null;
  timed_out: boolean;
  duration_ms: number | null;
  loop: LoopMeta | null;
}

export const harnessKeys = {
  all: ["harness"] as const,
  status: (slug: string) => [...harnessKeys.all, "status", slug] as const,
  stepDetail: (slug: string, wave: number, step: number) =>
    [...harnessKeys.all, "step", slug, wave, step] as const,
};

export function useHarnessStatus(slug: string) {
  return useQuery({
    queryKey: harnessKeys.status(slug),
    queryFn: () =>
      apiFetch<WorkspaceStatus>(`/hub/projects/${slug}/harness/status`),
    retry: false,
  });
}

export function useStepDetail(
  slug: string,
  wave: number,
  step: number,
  enabled = true
) {
  return useQuery({
    queryKey: harnessKeys.stepDetail(slug, wave, step),
    queryFn: () =>
      apiFetch<StepDetail>(
        `/hub/projects/${slug}/harness/waves/${wave}/steps/${step}`
      ),
    enabled: enabled && wave > 0 && step > 0,
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

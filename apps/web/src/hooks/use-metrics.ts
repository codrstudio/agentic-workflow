import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface ProjectMetrics {
  total_tokens: number;
  total_cost_usd: number;
  total_sessions: number;
  total_features: number;
  features_passing: number;
  avg_session_tokens: number;
  avg_session_duration_ms: number | null;
}

export interface SessionMetrics {
  id: string;
  title: string;
  messages_count: number;
  tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  last_message_at: string | null;
  created_at: string;
}

export interface StepMetrics {
  wave: number;
  step: number;
  name: string;
  agent: string;
  duration_ms: number | null;
  exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
  tokens: number;
}

export const metricsKeys = {
  all: (slug: string) => ["metrics", slug] as const,
  summary: (slug: string) => [...metricsKeys.all(slug), "summary"] as const,
  sessions: (slug: string) => [...metricsKeys.all(slug), "sessions"] as const,
  steps: (slug: string) => [...metricsKeys.all(slug), "steps"] as const,
};

export function useProjectMetrics(projectSlug: string) {
  return useQuery({
    queryKey: metricsKeys.summary(projectSlug),
    queryFn: () =>
      apiFetch<ProjectMetrics>(`/hub/projects/${projectSlug}/metrics`),
  });
}

export function useSessionMetrics(projectSlug: string) {
  return useQuery({
    queryKey: metricsKeys.sessions(projectSlug),
    queryFn: () =>
      apiFetch<SessionMetrics[]>(`/hub/projects/${projectSlug}/metrics/sessions`),
  });
}

export function useStepMetrics(projectSlug: string) {
  return useQuery({
    queryKey: metricsKeys.steps(projectSlug),
    queryFn: () =>
      apiFetch<StepMetrics[]>(`/hub/projects/${projectSlug}/metrics/steps`),
  });
}

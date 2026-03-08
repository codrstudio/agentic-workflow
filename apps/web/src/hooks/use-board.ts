import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// --- Types (mirrors server schemas) ---

export interface FeatureBoardMeta {
  assignee: "agent" | "human" | "pending" | "paused";
  priority: "critical" | "high" | "medium" | "low";
  labels: string[];
  estimated_cost_usd?: number;
  actual_cost_usd?: number;
  sprint_column?: string;
  linked_handoff_id?: string | null;
}

export interface FeatureWithMeta {
  id: string;
  name: string;
  description: string;
  status: string;
  priority: number;
  agent: string;
  task: string;
  dependencies: string[];
  tests: string[];
  prp_path?: string;
  completed_at?: string;
  board_meta: FeatureBoardMeta;
}

export interface BoardColumn {
  id: string;
  label: string;
  status_filter: string[];
  assignee_filter?: string[];
  color?: string;
  wip_limit?: number;
}

export interface BoardColumnView extends BoardColumn {
  features: FeatureWithMeta[];
}

export interface BoardConfig {
  project_id: string;
  sprint: number;
  columns: BoardColumn[];
  routing_rules: { condition: string; assignee: string }[];
  updated_at: string;
}

export interface BoardView {
  config: BoardConfig;
  columns: BoardColumnView[];
}

// --- Query keys ---

export const boardKeys = {
  all: (slug: string) => ["board", slug] as const,
  view: (slug: string, sprint: number) =>
    [...boardKeys.all(slug), "view", sprint] as const,
  config: (slug: string, sprint: number) =>
    [...boardKeys.all(slug), "config", sprint] as const,
};

// --- Hooks ---

export function useBoardView(projectSlug: string, sprint: number) {
  return useQuery({
    queryKey: boardKeys.view(projectSlug, sprint),
    queryFn: () =>
      apiFetch<BoardView>(
        `/hub/projects/${projectSlug}/board?sprint=${sprint}`
      ),
    enabled: sprint > 0,
    staleTime: 15_000,
  });
}

export function useBoardConfig(projectSlug: string, sprint: number) {
  return useQuery({
    queryKey: boardKeys.config(projectSlug, sprint),
    queryFn: () =>
      apiFetch<BoardConfig>(
        `/hub/projects/${projectSlug}/board-config?sprint=${sprint}`
      ),
    enabled: sprint > 0,
  });
}

export function useMoveFeature(projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      feature_id: string;
      sprint: number;
      target_column_id: string;
      target_assignee?: string;
    }) =>
      apiFetch<FeatureWithMeta>(
        `/hub/projects/${projectSlug}/board/move`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all(projectSlug) });
    },
  });
}

export function useAutoRoute(projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { sprint: number; feature_ids?: string[] }) =>
      apiFetch<{ routed: { feature_id: string; assignee: string }[] }>(
        `/hub/projects/${projectSlug}/board/auto-route`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: boardKeys.all(projectSlug) });
    },
  });
}

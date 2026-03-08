import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// --- Types ---

export interface ModelCatalogEntry {
  id: string;
  display_name: string;
  tier: "fast" | "balanced" | "powerful";
  cost_tier: "low" | "medium" | "high";
  description: string;
}

export interface StepModelOverride {
  model: string;
  model_fallback?: string;
}

export interface PhaseModelConfig {
  project_id: string;
  workflow: string;
  step_overrides: Record<string, StepModelOverride>;
  updated_at: string;
}

// --- Query keys ---

export const modelConfigKeys = {
  all: ["model-config"] as const,
  catalog: () => [...modelConfigKeys.all, "catalog"] as const,
  phaseConfig: (slug: string, workflow: string) =>
    [...modelConfigKeys.all, "phase", slug, workflow] as const,
};

// --- Hooks ---

export function useModelCatalog() {
  return useQuery({
    queryKey: modelConfigKeys.catalog(),
    queryFn: () =>
      apiFetch<{ models: ModelCatalogEntry[] }>("/hub/model-catalog").then(
        (r) => r.models
      ),
  });
}

export function usePhaseModelConfig(projectSlug: string, workflow: string) {
  return useQuery({
    queryKey: modelConfigKeys.phaseConfig(projectSlug, workflow),
    queryFn: () =>
      apiFetch<PhaseModelConfig>(
        `/hub/projects/${projectSlug}/phase-model-configs/${encodeURIComponent(workflow)}`
      ),
    enabled: !!workflow,
  });
}

export function usePatchPhaseModelConfig(
  projectSlug: string,
  workflow: string
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (stepOverrides: Record<string, StepModelOverride>) =>
      apiFetch<PhaseModelConfig>(
        `/hub/projects/${projectSlug}/phase-model-configs/${encodeURIComponent(workflow)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ step_overrides: stepOverrides }),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: modelConfigKeys.phaseConfig(projectSlug, workflow),
      });
    },
  });
}

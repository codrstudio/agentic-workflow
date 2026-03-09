import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// --- Types ---

export interface ModelOutputAttribution {
  id: string;
  project_id: string;
  artifact_id: string | null;
  feature_id: string | null;
  phase: string;
  step_name: string;
  model_used: string;
  spawn_dir: string | null;
  recorded_at: string;
}

// --- Query keys ---

export const modelAttributionKeys = {
  all: ["model-attributions"] as const,
  byFeature: (slug: string, featureId: string) =>
    [...modelAttributionKeys.all, slug, "feature", featureId] as const,
  byArtifact: (slug: string, artifactId: string) =>
    [...modelAttributionKeys.all, slug, "artifact", artifactId] as const,
  list: (slug: string) =>
    [...modelAttributionKeys.all, slug, "list"] as const,
};

// --- Hooks ---

/** Fetch all attributions for a feature (for ModelAttributionTab). */
export function useFeatureAttributions(projectSlug: string, featureId: string | null) {
  return useQuery({
    queryKey: featureId
      ? modelAttributionKeys.byFeature(projectSlug, featureId)
      : modelAttributionKeys.list(projectSlug),
    queryFn: () =>
      apiFetch<ModelOutputAttribution[]>(
        `/hub/projects/${projectSlug}/model-attributions${featureId ? `?feature_id=${encodeURIComponent(featureId)}&limit=200` : "?limit=200"}`
      ),
    enabled: !!featureId,
  });
}

/** Fetch attribution for a specific artifact (for ArtifactAttributionBadge). */
export function useArtifactAttribution(projectSlug: string, artifactId: string | null) {
  return useQuery({
    queryKey: artifactId
      ? modelAttributionKeys.byArtifact(projectSlug, artifactId)
      : modelAttributionKeys.list(projectSlug),
    queryFn: async () => {
      const all = await apiFetch<ModelOutputAttribution[]>(
        `/hub/projects/${projectSlug}/model-attributions?limit=500`
      );
      return all.find((a) => a.artifact_id === artifactId) ?? null;
    },
    enabled: !!artifactId,
  });
}

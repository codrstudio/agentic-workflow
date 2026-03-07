import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ComplexityLevel = "trivial" | "small" | "medium" | "large";
export type ClassificationMethod = "manual" | "auto_heuristic" | "auto_ai";

export interface TaskComplexity {
  id: string;
  project_id: string;
  title: string;
  description: string;
  complexity_level: ComplexityLevel;
  classification_method: ClassificationMethod;
  confidence?: number;
  signals?: {
    files_estimated?: number;
    components_affected?: number;
    has_db_changes?: boolean;
    has_api_changes?: boolean;
    has_ui_changes?: boolean;
    cross_cutting?: boolean;
  };
  spec_template: string;
  created_at: string;
}

export interface SpecTemplate {
  level: ComplexityLevel;
  template_name: string;
  required_sections: string[];
  optional_sections: string[];
  estimated_effort: string;
  markdown_template?: string;
}

export interface ClassifyTaskParams {
  title: string;
  description: string;
  method: ClassificationMethod;
  complexity_level?: ComplexityLevel;
}

export const taskComplexityKeys = {
  all: (slug: string) => ["projects", slug, "task-complexity"] as const,
  classifications: (slug: string) =>
    [...taskComplexityKeys.all(slug), "classifications"] as const,
  templates: (slug: string) =>
    [...taskComplexityKeys.all(slug), "templates"] as const,
};

export function useClassifyTask(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ClassifyTaskParams) =>
      apiFetch<TaskComplexity>(
        `/hub/projects/${projectSlug}/tasks/classify`,
        {
          method: "POST",
          body: JSON.stringify(params),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: taskComplexityKeys.classifications(projectSlug),
      });
    },
  });
}

export function useGetTemplate(projectSlug: string) {
  return useMutation({
    mutationFn: (level: ComplexityLevel) =>
      apiFetch<SpecTemplate & { markdown_template: string }>(
        `/hub/projects/${projectSlug}/tasks/templates/${level}`
      ),
  });
}

export function useAllTemplates(projectSlug: string) {
  return useQuery({
    queryKey: taskComplexityKeys.templates(projectSlug),
    queryFn: () =>
      apiFetch<SpecTemplate[]>(
        `/hub/projects/${projectSlug}/tasks/templates`
      ),
  });
}

export function useClassifications(projectSlug: string, limit = 50) {
  return useQuery({
    queryKey: [...taskComplexityKeys.classifications(projectSlug), limit],
    queryFn: () =>
      apiFetch<TaskComplexity[]>(
        `/hub/projects/${projectSlug}/tasks/classifications?limit=${limit}`
      ),
  });
}

export function useUpdateTemplates(projectSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (templates: SpecTemplate[]) =>
      apiFetch<SpecTemplate[]>(
        `/hub/projects/${projectSlug}/tasks/templates`,
        {
          method: "PUT",
          body: JSON.stringify(templates),
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: taskComplexityKeys.templates(projectSlug),
      });
    },
  });
}

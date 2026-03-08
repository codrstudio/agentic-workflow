import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ContainmentLevel = "unrestricted" | "standard" | "restricted" | "isolated";

export interface ContainmentPolicy {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  level: ContainmentLevel;
  applies_to: {
    steps: string[] | null;
    agents: string[] | null;
  };
  execution_limits: {
    max_turns: number;
    timeout_minutes: number;
    max_output_tokens: number | null;
  };
  path_restrictions: {
    allowed_paths: string[];
    blocked_paths: string[];
    read_only: string[];
  };
  tool_restrictions: {
    allowed_tools: string[] | null;
    blocked_tools: string[] | null;
  };
  graduated_response: {
    on_timeout: "kill" | "warn_and_extend" | "save_and_kill";
    on_drift: "ignore" | "warn" | "intervene" | "kill";
  };
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export type CreateContainmentPolicyBody = Omit<ContainmentPolicy, "id" | "project_id" | "created_at" | "updated_at">;
export type PatchContainmentPolicyBody = Partial<CreateContainmentPolicyBody>;

const keys = {
  all: (slug: string) => ["containment-policies", slug] as const,
  list: (slug: string) => [...keys.all(slug), "list"] as const,
};

export function useContainmentPolicies(projectSlug: string) {
  return useQuery({
    queryKey: keys.list(projectSlug),
    queryFn: () =>
      apiFetch<ContainmentPolicy[]>(
        `/hub/projects/${projectSlug}/containment/policies`
      ),
  });
}

export function useCreateContainmentPolicy(projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateContainmentPolicyBody) =>
      apiFetch<ContainmentPolicy>(
        `/hub/projects/${projectSlug}/containment/policies`,
        { method: "POST", body: JSON.stringify(body) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(projectSlug) }),
  });
}

export function useUpdateContainmentPolicy(projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: PatchContainmentPolicyBody & { id: string }) =>
      apiFetch<ContainmentPolicy>(
        `/hub/projects/${projectSlug}/containment/policies/${id}`,
        { method: "PATCH", body: JSON.stringify(body) }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(projectSlug) }),
  });
}

export function useDeleteContainmentPolicy(projectSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(
        `/hub/projects/${projectSlug}/containment/policies/${id}`,
        { method: "DELETE" }
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.list(projectSlug) }),
  });
}

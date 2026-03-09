import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Resource {
  slug: string;
  name: string;
  description: string;
  source: string;
}

export function allSkillsQueryOptions() {
  return queryOptions({
    queryKey: ["skills"],
    queryFn: () => request<Resource[]>("/skills"),
  });
}

export function agentSkillsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["agents", agentId, "skills"],
    queryFn: () => request<Resource[]>(`/agents/${agentId}/skills`),
  });
}

export async function assignSkill(
  agentId: string,
  slug: string,
  sourceScope: string,
): Promise<void> {
  await request("/skills/assign", {
    method: "POST",
    body: JSON.stringify({ sourceScope, slug, agentId }),
  });
}

export async function unassignSkill(
  agentId: string,
  slug: string,
): Promise<void> {
  await request(`/skills/${agentId}/${slug}`, { method: "DELETE" });
}

export function allServicesQueryOptions() {
  return queryOptions({
    queryKey: ["services"],
    queryFn: () => request<Resource[]>("/services"),
  });
}

export function agentServicesQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["agents", agentId, "services"],
    queryFn: () => request<Resource[]>(`/agents/${agentId}/services`),
  });
}

export async function assignService(
  agentId: string,
  slug: string,
  sourceScope: string,
): Promise<void> {
  await request("/services/assign", {
    method: "POST",
    body: JSON.stringify({ sourceScope, slug, agentId }),
  });
}

export async function unassignService(
  agentId: string,
  slug: string,
): Promise<void> {
  await request(`/services/${agentId}/${slug}`, { method: "DELETE" });
}

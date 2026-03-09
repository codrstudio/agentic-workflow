import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";
import type { Agent } from "./agents";

export interface AgentTemplate {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
}

export interface AgentTemplateDetail extends AgentTemplate {
  content: string;
  suggestedSkills: string[];
  heartbeatEnabled: boolean;
  activeHours: string;
  preview: {
    soul: string;
    conversation: string;
    heartbeat: string;
  };
}

export interface CreateFromTemplatePayload {
  template: string;
  owner: string;
  slug: string;
  name?: string;
  description?: string;
  enabled?: boolean;
}

export function agentTemplatesQueryOptions() {
  return queryOptions({
    queryKey: ["templates", "agents"],
    queryFn: () => request<{ templates: AgentTemplate[] }>("/templates/agents"),
  });
}

export function agentTemplateQueryOptions(slug: string) {
  return queryOptions({
    queryKey: ["templates", "agents", slug],
    queryFn: () => request<AgentTemplateDetail>(`/templates/agents/${slug}`),
  });
}

export async function createAgentFromTemplate(
  data: CreateFromTemplatePayload,
): Promise<Agent> {
  return request<Agent>("/agents/from-template", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

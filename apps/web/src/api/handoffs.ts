import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Handoff {
  id: number;
  supervisorId: string;
  memberId: string;
  label: string;
  triggerIntent: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

export interface CreateHandoffBody {
  memberId: string;
  label: string;
  triggerIntent: string;
  priority?: number;
}

export interface UpdateHandoffBody {
  label?: string;
  triggerIntent?: string;
  priority?: number;
  enabled?: boolean;
}

export const handoffsQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["handoffs", agentId],
    queryFn: () => request<Handoff[]>(`/agents/${agentId}/handoffs`),
  });

export function createHandoff(agentId: string, body: CreateHandoffBody) {
  return request<Handoff>(`/agents/${agentId}/handoffs`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateHandoff(agentId: string, id: number, body: UpdateHandoffBody) {
  return request<Handoff>(`/agents/${agentId}/handoffs/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteHandoff(agentId: string, id: number) {
  return request<{ ok: boolean }>(`/agents/${agentId}/handoffs/${id}`, {
    method: "DELETE",
  });
}

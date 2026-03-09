import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface AgentQuotaConfig {
  maxTokensPerHour: number | null;
  maxHeartbeatsDay: number | null;
  maxToolTimeoutMs: number;
  maxTokensPerRun: number | null;
  pauseOnExceed: boolean;
}

export interface AgentQuotaUsageWindow {
  windowStart: string;
  tokensUsed?: number;
  toolCalls?: number;
  heartbeats?: number;
  pctUsed: number | null;
}

export interface AgentQuota {
  agentId: string;
  config: AgentQuotaConfig;
  usage: {
    hourly: AgentQuotaUsageWindow;
    daily: AgentQuotaUsageWindow;
  };
  status: "active" | "paused_quota";
}

export interface UpdateQuotaBody {
  maxTokensPerHour?: number | null;
  maxHeartbeatsDay?: number | null;
  maxToolTimeoutMs?: number | null;
  maxTokensPerRun?: number | null;
  pauseOnExceed?: boolean;
}

export const quotaQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["quota", agentId],
    queryFn: () => request<AgentQuota>(`/agents/${agentId}/quota`),
  });

export function updateQuota(agentId: string, body: UpdateQuotaBody) {
  return request<{ ok: boolean; config: AgentQuotaConfig }>(`/agents/${agentId}/quota`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteQuota(agentId: string) {
  return request<{ ok: boolean }>(`/agents/${agentId}/quota`, {
    method: "DELETE",
  });
}

export function resetQuota(agentId: string) {
  return request<{ ok: boolean; resetWindows: { hourly: string; daily: string } }>(
    `/agents/${agentId}/quota/reset`,
    { method: "POST" }
  );
}

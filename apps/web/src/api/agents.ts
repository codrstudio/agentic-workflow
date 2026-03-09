import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface Agent {
  id: string;
  slug: string;
  owner: string;
  enabled: boolean;
  description?: string;
  heartbeatEnabled?: boolean;
  role?: string;
  members?: string[];
}

export interface AgentStats {
  totalRuns: number;
  byStatus: { ok: number; skipped: number; error: number };
  totalCostUsd: number;
  avgDurationMs: number;
  lastTimestamp?: string;
}

export function agentsQueryOptions(scope?: "all") {
  return queryOptions({
    queryKey: scope ? ["agents", "scope", scope] : ["agents"],
    queryFn: () => request<Agent[]>(scope ? `/agents?scope=${scope}` : "/agents"),
  });
}

export function agentQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["agents", id],
    queryFn: () => request<Agent>(`/agents/${id}`),
  });
}

export function agentStatsQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "stats"],
    queryFn: () => request<AgentStats>(`/agents/${id}/heartbeat/stats`),
  });
}

export interface HeartbeatLogEntry {
  id: string;
  status: "ok" | "skipped" | "error";
  durationMs: number;
  preview?: string;
  createdAt: string;
}

export function agentHeartbeatHistoryQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "heartbeat-history"],
    queryFn: () => request<HeartbeatLogEntry[]>(`/agents/${id}/heartbeat/history`),
  });
}

export async function toggleAgentEnabled(id: string): Promise<void> {
  await request(`/agents/${id}/heartbeat/toggle`, { method: "POST" });
}

export async function triggerHeartbeat(id: string): Promise<void> {
  await request(`/agents/${id}/heartbeat/trigger`, { method: "POST" });
}

export interface CreateAgentPayload {
  slug: string;
  owner: string;
  description?: string;
  enabled?: boolean;
}

export async function createAgent(payload: CreateAgentPayload): Promise<Agent> {
  return request<Agent>("/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface AgentFileResponse {
  filename: string;
  content: string;
}

export function agentFileQueryOptions(id: string, filename: string) {
  return queryOptions({
    queryKey: ["agents", id, "files", filename],
    queryFn: () => request<AgentFileResponse>(`/agents/${id}/files/${filename}`),
    retry: false,
  });
}

export async function saveAgentFile(
  id: string,
  filename: string,
  content: string,
  changeNote?: string,
): Promise<void> {
  await request(`/agents/${id}/files/${filename}`, {
    method: "PUT",
    body: JSON.stringify({ content, change_note: changeNote }),
  });
}

export interface HeartbeatConfigData {
  enabled: boolean;
  intervalMs: number;
  activeHoursStart?: string;
  activeHoursEnd?: string;
  activeHoursDays?: number[];
}

export function extractHeartbeatConfig(agent: Agent & { heartbeat?: { enabled: boolean; intervalMs: number }; metadata?: Record<string, unknown> }): HeartbeatConfigData {
  return {
    enabled: agent.heartbeat?.enabled ?? agent.heartbeatEnabled ?? false,
    intervalMs: agent.heartbeat?.intervalMs ?? 30000,
    activeHoursStart: (agent.metadata?.["active-hours-start"] as string) ?? undefined,
    activeHoursEnd: (agent.metadata?.["active-hours-end"] as string) ?? undefined,
    activeHoursDays: (agent.metadata?.["active-hours-days"] as number[]) ?? undefined,
  };
}

export async function duplicateAgent(id: string): Promise<Agent> {
  return request<Agent>(`/agents/${id}/duplicate`, { method: "POST" });
}

export async function deleteAgent(id: string): Promise<void> {
  await request(`/agents/${id}`, { method: "DELETE" });
}

export interface MemoryStatus {
  fileCount: number;
  chunkCount: number;
  lastSync?: string;
}

export function agentMemoryStatusQueryOptions(id: string) {
  return queryOptions({
    queryKey: ["agents", id, "memory", "status"],
    queryFn: () => request<MemoryStatus>(`/agents/${id}/memory/status`),
  });
}

export interface MemorySearchResult {
  path: string;
  snippet: string;
  score: number;
  source: "vector" | "text";
}

export async function searchAgentMemory(
  id: string,
  query: string,
  limit = 10,
): Promise<MemorySearchResult[]> {
  return request<MemorySearchResult[]>(`/agents/${id}/memory/search`, {
    method: "POST",
    body: JSON.stringify({ query, limit }),
  });
}

export async function syncAgentMemory(id: string): Promise<void> {
  await request(`/agents/${id}/memory/sync`, { method: "POST" });
}

export async function resetAgentMemory(id: string): Promise<void> {
  await request(`/agents/${id}/memory/reset`, { method: "POST" });
}

export async function saveHeartbeatConfig(
  id: string,
  config: HeartbeatConfigData,
): Promise<Agent> {
  return request<Agent>(`/agents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      heartbeatEnabled: config.enabled,
      heartbeatInterval: config.intervalMs,
      metadata: {
        "active-hours-start": config.activeHoursStart ?? null,
        "active-hours-end": config.activeHoursEnd ?? null,
        "active-hours-days": config.activeHoursDays ?? null,
      },
    }),
  });
}

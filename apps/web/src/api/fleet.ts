import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export type FleetStatus = "active" | "paused" | "alert" | "killed" | "error";

export interface FleetAgent {
  id: string;
  label: string;
  owner: string;
  enabled: boolean;
  status: FleetStatus;
  circuitBreaker: {
    killSwitch: boolean;
    tripped: boolean;
  };
  health: {
    heartbeatSuccessRate24h: number;
    lastHeartbeat: string | null;
    lastHeartbeatResult: string | null;
    consecutiveFails: number;
  };
  consumption: {
    tokensToday: number;
    costToday: number;
  };
  activity: {
    conversationsToday: number;
    cronRunsToday: number;
    lastActivity: string | null;
  };
  alerts: string[];
  channels: string[];
}

export interface FleetResponse {
  agents: FleetAgent[];
  total: number;
  filtered: number;
}

export interface FleetSummary {
  totalAgents: number;
  activeAgents: number;
  pausedAgents: number;
  errorAgents: number;
  killedAgents: number;
  totalTokensToday: number;
  totalCostToday: number;
  avgHealthRate: number;
  activeAlerts: number;
}

export type BatchAction =
  | "enable"
  | "disable"
  | "trigger_heartbeat"
  | "activate_kill_switch"
  | "deactivate_kill_switch";

export interface BatchResult {
  results: Array<{ agentId: string; ok: boolean; error?: string }>;
}

export interface FleetQueryParams {
  owner?: string;
  status?: FleetStatus;
  sortBy?: "name" | "tokens" | "errors" | "lastActivity";
  sortDir?: "asc" | "desc";
}

export function fleetQueryOptions(params: FleetQueryParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.owner) searchParams.set("owner", params.owner);
  if (params.status) searchParams.set("status", params.status);
  if (params.sortBy) searchParams.set("sortBy", params.sortBy);
  if (params.sortDir) searchParams.set("sortDir", params.sortDir);
  const qs = searchParams.toString();

  return queryOptions({
    queryKey: ["fleet", params],
    queryFn: () => request<FleetResponse>(`/fleet${qs ? `?${qs}` : ""}`),
    refetchInterval: 30_000,
  });
}

export function fleetSummaryQueryOptions() {
  return queryOptions({
    queryKey: ["fleet", "summary"],
    queryFn: () => request<FleetSummary>("/fleet/summary"),
    refetchInterval: 30_000,
  });
}

export async function fleetBatch(
  agentIds: string[],
  action: BatchAction
): Promise<BatchResult> {
  return request<BatchResult>("/fleet/batch", {
    method: "POST",
    body: JSON.stringify({ agentIds, action }),
  });
}

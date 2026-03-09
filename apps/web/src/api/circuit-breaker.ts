import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface CircuitBreakerConfig {
  agentId: string;
  enabled: boolean;
  maxConsecutiveFails: number;
  errorRateThreshold: number;
  errorRateWindowMin: number;
  maxActionsPerHour: number;
  maxActionsPerDay: number;
  cooldownMin: number;
  autoResume: boolean;
}

export interface CircuitBreakerState {
  agentId: string;
  killSwitch: boolean;
  tripped: boolean;
  trippedAt: string | null;
  resumeAt: string | null;
  consecutiveFails: number;
  actionsThisHour: number;
  actionsToday: number;
  config: CircuitBreakerConfig;
}

export type CircuitBreakerEventType =
  | "tripped"
  | "resumed"
  | "kill_switch_on"
  | "kill_switch_off"
  | "action_blocked";

export interface CircuitBreakerEvent {
  id: string;
  agentId: string;
  eventType: CircuitBreakerEventType;
  triggerReason: string | null;
  context: string | null;
  actor: string | null;
  createdAt: string;
}

export interface UpdateCircuitBreakerConfig {
  enabled?: boolean;
  maxConsecutiveFails?: number;
  errorRateThreshold?: number;
  errorRateWindowMin?: number;
  maxActionsPerHour?: number;
  maxActionsPerDay?: number;
  cooldownMin?: number;
  autoResume?: boolean;
}

export function circuitBreakerQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["circuit-breaker", agentId],
    queryFn: () => request<CircuitBreakerState>(`/agents/${agentId}/circuit-breaker`),
  });
}

export function circuitBreakerEventsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["circuit-breaker", agentId, "events"],
    queryFn: () =>
      request<{ events: CircuitBreakerEvent[]; page: number; limit: number; total: number }>(
        `/agents/${agentId}/circuit-breaker/events?limit=20`,
      ).then((r) => r.events),
  });
}

export function updateCircuitBreakerConfig(agentId: string, body: UpdateCircuitBreakerConfig) {
  return request<CircuitBreakerConfig>(
    `/agents/${agentId}/circuit-breaker/config`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function activateKillSwitch(agentId: string) {
  return request<CircuitBreakerState>(`/agents/${agentId}/circuit-breaker/kill`, {
    method: "POST",
  });
}

export function resumeCircuitBreaker(agentId: string) {
  return request<CircuitBreakerState>(`/agents/${agentId}/circuit-breaker/resume`, {
    method: "POST",
  });
}

/** All circuit-breaker states — used for badge map in agent list */
export function systemCircuitBreakerQueryOptions() {
  return queryOptions({
    queryKey: ["circuit-breaker", "system"],
    queryFn: () => request<CircuitBreakerState[]>("/system/circuit-breaker"),
  });
}

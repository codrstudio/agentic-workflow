import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface AnalyticsOverview {
  heartbeats: {
    total: number;
    ok: number;
    error: number;
    skipped: number;
    errorRate: number;
  };
  conversations: {
    total: number;
    messagesIn: number;
    messagesOut: number;
  };
  cron: {
    total: number;
    ok: number;
    error: number;
    errorRate: number;
  };
  avgResponseMs: number;
  comparison: {
    heartbeatErrorRateDelta: number;
    conversationsDelta: number;
    avgResponseMsDelta: number;
  };
}

export interface AnalyticsTrendPoint {
  date: string;
  [key: string]: unknown;
}

export interface AnalyticsTrend {
  metric: string;
  points: AnalyticsTrendPoint[];
}

export interface AgentRankingEntry {
  agentId: string;
  heartbeats: number;
  errorRate: number;
  conversations: number;
  avgResponseMs: number;
  costUsd: number;
}

export interface AgentRanking {
  agents: AgentRankingEntry[];
}

export function analyticsOverviewQueryOptions(params: {
  from: string;
  to: string;
  agentId?: string;
}) {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.agentId) sp.set("agent_id", params.agentId);

  return queryOptions({
    queryKey: ["analytics", "overview", params],
    queryFn: () => request<AnalyticsOverview>(`/analytics/overview?${sp}`),
  });
}

export function analyticsTrendQueryOptions(params: {
  from: string;
  to: string;
  metric: string;
  agentId?: string;
}) {
  const sp = new URLSearchParams({
    from: params.from,
    to: params.to,
    metric: params.metric,
  });
  if (params.agentId) sp.set("agent_id", params.agentId);

  return queryOptions({
    queryKey: ["analytics", "trend", params],
    queryFn: () => request<AnalyticsTrend>(`/analytics/trend?${sp}`),
  });
}

export function analyticsAgentsQueryOptions(params: {
  from: string;
  to: string;
}) {
  const sp = new URLSearchParams({ from: params.from, to: params.to });

  return queryOptions({
    queryKey: ["analytics", "agents", params],
    queryFn: () => request<AgentRanking>(`/analytics/agents?${sp}`),
  });
}

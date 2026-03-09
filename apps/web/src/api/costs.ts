import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface CostSummary {
  totalCostUsd: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCalls: number;
  byAgent: Array<{
    agentId: string;
    costUsd: number;
    tokensIn: number;
    tokensOut: number;
    calls: number;
  }>;
  byOperation: Array<{
    operation: string;
    costUsd: number;
    calls: number;
  }>;
}

export interface CostTrendPoint {
  date: string;
  costUsd: number;
  tokensIn: number;
  tokensOut: number;
  calls: number;
}

export interface CostTrend {
  points: CostTrendPoint[];
}

export interface BudgetAlert {
  id: number;
  scope: string;
  threshold: number;
  period: "daily" | "weekly" | "monthly";
  enabled: boolean;
  createdAt: string;
}

export function costSummaryQueryOptions(params: {
  from: string;
  to: string;
  agentId?: string;
}) {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.agentId) sp.set("agent_id", params.agentId);

  return queryOptions({
    queryKey: ["costs", "summary", params],
    queryFn: () => request<CostSummary>(`/costs/summary?${sp}`),
  });
}

export function costTrendQueryOptions(params: {
  from: string;
  to: string;
  granularity?: string;
  agentId?: string;
}) {
  const sp = new URLSearchParams({ from: params.from, to: params.to });
  if (params.granularity) sp.set("granularity", params.granularity);
  if (params.agentId) sp.set("agent_id", params.agentId);

  return queryOptions({
    queryKey: ["costs", "trend", params],
    queryFn: () => request<CostTrend>(`/costs/trend?${sp}`),
  });
}

export function budgetAlertsQueryOptions() {
  return queryOptions({
    queryKey: ["budget-alerts"],
    queryFn: () => request<BudgetAlert[]>("/budget-alerts"),
  });
}

export async function createBudgetAlert(data: {
  scope: string;
  threshold: number;
  period: string;
}) {
  return request<BudgetAlert>("/budget-alerts", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateBudgetAlert(
  id: number,
  data: Partial<{
    scope: string;
    threshold: number;
    period: string;
    enabled: boolean;
  }>,
) {
  return request<BudgetAlert>(`/budget-alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteBudgetAlert(id: number) {
  return request<{ status: string }>(`/budget-alerts/${id}`, {
    method: "DELETE",
  });
}

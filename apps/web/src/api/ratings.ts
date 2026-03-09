import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface RatingItem {
  id: string;
  session_id: string;
  message_index: number;
  agent_id: string;
  channel_type: string;
  rating: "up" | "down";
  reason: string | null;
  reason_cat: string | null;
  user_ref: string | null;
  rated_at: string;
}

export interface RatingsListResponse {
  total: number;
  limit: number;
  offset: number;
  items: RatingItem[];
}

export interface RatingTrendPoint {
  date: string;
  total: number;
  approvalRate: number;
}

export interface RatingsSummary {
  agentId: string;
  period: { from: string; to: string };
  total: number;
  approvalRate: number;
  upCount: number;
  downCount: number;
  byCategory: Record<string, number>;
  byChannel: Record<string, { total: number; approvalRate: number }>;
  trend: RatingTrendPoint[];
}

export interface ExportGoldenSetResponse {
  evalSetId: string;
  casesExported: number;
  path: string;
}

export interface RatingsListParams {
  from?: string;
  to?: string;
  channelType?: string;
  rating?: "up" | "down";
  limit?: number;
  offset?: number;
}

export function agentRatingsSummaryQueryOptions(
  agentId: string,
  params?: { from?: string; to?: string; channelType?: string },
) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.channelType) search.set("channelType", params.channelType);
  const qs = search.toString();
  return queryOptions({
    queryKey: ["agents", agentId, "ratings", "summary", params ?? {}],
    queryFn: () =>
      request<RatingsSummary>(`/agents/${agentId}/ratings/summary${qs ? `?${qs}` : ""}`),
  });
}

export function agentRatingsListQueryOptions(agentId: string, params?: RatingsListParams) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.channelType) search.set("channelType", params.channelType);
  if (params?.rating) search.set("rating", params.rating);
  if (params?.limit != null) search.set("limit", String(params.limit));
  if (params?.offset != null) search.set("offset", String(params.offset));
  const qs = search.toString();
  return queryOptions({
    queryKey: ["agents", agentId, "ratings", "list", params ?? {}],
    queryFn: () =>
      request<RatingsListResponse>(`/agents/${agentId}/ratings${qs ? `?${qs}` : ""}`),
  });
}

export interface GlobalRatingAgent {
  agentId: string;
  total: number;
  upCount: number;
  downCount: number;
  approvalRate: number;
  trend: "up" | "down" | "stable";
  alert: boolean;
  lastRatedAt: string;
}

export interface GlobalRatingsDashboard {
  period: { from: string; to: string };
  globalTotal: number;
  globalApprovalRate: number;
  agents: GlobalRatingAgent[];
}

export interface GlobalRatingsParams {
  from?: string;
  to?: string;
  channelType?: string;
}

export function globalRatingsQueryOptions(params?: GlobalRatingsParams) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  if (params?.channelType) search.set("channelType", params.channelType);
  const qs = search.toString();
  return queryOptions({
    queryKey: ["ratings", "global", params ?? {}],
    queryFn: () => request<GlobalRatingsDashboard>(`/ratings${qs ? `?${qs}` : ""}`),
  });
}

export async function exportGoldenSet(
  agentId: string,
  params?: { rating?: "up" | "down"; from?: string; to?: string; limit?: number },
): Promise<ExportGoldenSetResponse> {
  return request<ExportGoldenSetResponse>(`/agents/${agentId}/ratings/export-golden-set`, {
    method: "POST",
    body: JSON.stringify(params ?? { rating: "down" }),
  });
}

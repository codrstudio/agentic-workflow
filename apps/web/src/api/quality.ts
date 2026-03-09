import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface QualityTrendPoint {
  date: string;
  up: number;
  down: number;
  approvalRate: number;
}

export interface TopReason {
  reason: string;
  count: number;
}

export interface AgentQuality {
  agentId: string;
  period: { from: string; to: string };
  totalRatings: number;
  upCount: number;
  downCount: number;
  approvalRate: number;
  trend: QualityTrendPoint[];
  topReasons: TopReason[];
}

export interface LowRatedItem {
  id: number;
  sessionId: string;
  messageId: string;
  reason: string | null;
  createdAt: string;
  input: string;
  output: string;
}

export const agentQualityQueryOptions = (agentId: string, days: number) =>
  queryOptions({
    queryKey: ["quality", agentId, days],
    queryFn: () =>
      request<AgentQuality>(`/agents/${agentId}/quality?days=${days}`),
  });

export const lowRatedQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["quality", agentId, "low-rated"],
    queryFn: () =>
      request<LowRatedItem[]>(`/agents/${agentId}/quality/low-rated`),
  });

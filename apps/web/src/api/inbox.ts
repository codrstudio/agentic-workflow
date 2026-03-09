import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface InboxLastMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface InboxSession {
  sessionId: string;
  agentId: string;
  agentLabel: string;
  channelType: string;
  channelId: string | null;
  status: "agent" | "operator" | "waiting";
  lastMessage: InboxLastMessage | null;
  waitingSince: string | null;
  operatorId: string | null;
  startedAt: string;
  messageCount: number;
}

export interface InboxResponse {
  sessions: InboxSession[];
  total: number;
  offset: number;
  limit: number;
}

export interface InboxChannelMetrics {
  channel: string;
  count: number;
  avgResponseMs: number | null;
}

export interface InboxVolumeByHour {
  hour: string;
  count: number;
}

export interface InboxMetrics {
  totalActive: number;
  byChannel: InboxChannelMetrics[];
  byStatus: Record<string, number>;
  volumeByHour: InboxVolumeByHour[];
}

export interface InboxParams {
  channel?: string;
  agent_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const inboxQueryOptions = (params: InboxParams = {}) => {
  const qs = new URLSearchParams();
  if (params.channel) qs.set("channel", params.channel);
  if (params.agent_id) qs.set("agent_id", params.agent_id);
  if (params.status) qs.set("status", params.status);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();

  return queryOptions({
    queryKey: ["inbox", params],
    queryFn: () => request<InboxResponse>(`/inbox${query ? `?${query}` : ""}`),
  });
};

export const inboxMetricsQueryOptions = () =>
  queryOptions({
    queryKey: ["inbox", "metrics"],
    queryFn: () => request<InboxMetrics>("/inbox/metrics"),
  });

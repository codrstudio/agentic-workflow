import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface SecurityEvent {
  id: number;
  agent_id: string;
  session_id: string | null;
  event_type: string;
  action: string;
  severity: string;
  pattern_matched: string | null;
  score: number;
  input_excerpt: string | null;
  input_hash: string;
  created_at: string;
}

export interface SecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
  limit: number;
  offset: number;
}

export interface SecuritySummaryTrendPoint {
  date: string;
  blocked: number;
  flagged: number;
  total: number;
}

export interface SecuritySummary {
  totalEvents: number;
  byAction: { action: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byAgent: { agent_id: string; count: number }[];
  trend: SecuritySummaryTrendPoint[];
}

export interface SecurityRule {
  id: number;
  name: string;
  description: string | null;
  pattern: string;
  rule_type: string;
  severity: string;
  action: string;
  is_system: number;
  enabled: number;
  created_at: string;
}

export interface SecurityEventsParams {
  agent_id?: string;
  severity?: string;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const securitySummaryQueryOptions = (days: number = 7) =>
  queryOptions({
    queryKey: ["security", "summary", days],
    queryFn: () => request<SecuritySummary>(`/security/summary?days=${days}`),
  });

export const securityEventsQueryOptions = (params: SecurityEventsParams = {}) => {
  const qs = new URLSearchParams();
  if (params.agent_id) qs.set("agent_id", params.agent_id);
  if (params.severity) qs.set("severity", params.severity);
  if (params.action) qs.set("action", params.action);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.offset != null) qs.set("offset", String(params.offset));
  const query = qs.toString();

  return queryOptions({
    queryKey: ["security", "events", params],
    queryFn: () =>
      request<SecurityEventsResponse>(`/security/events${query ? `?${query}` : ""}`),
  });
};

export const securityRulesQueryOptions = () =>
  queryOptions({
    queryKey: ["security", "rules"],
    queryFn: () => request<SecurityRule[]>("/security/rules"),
  });

import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface LgpdDataMapEntry {
  id: number;
  agent_id: string;
  data_type: string;
  label: string;
  purpose: string;
  legal_basis: string;
  retention_days: number | null;
  updated_at: string;
}

export interface LgpdConsentLog {
  id: number;
  agent_id: string;
  channel_id: string;
  user_ref: string;
  action: string;
  purpose: string;
  ip_address: string | null;
  recorded_at: string;
}

export interface RightsRequest {
  id: string;
  user_ref: string;
  right_type: string;
  agent_id: string | null;
  description: string | null;
  status: string;
  response: string | null;
  requested_at: string;
  resolved_at: string | null;
}

export interface RightsRequestFilters {
  status?: string;
  right_type?: string;
}

export interface ConsentLogFilters {
  agentId?: string;
  userRef?: string;
  from?: string;
  to?: string;
}

export interface LgpdReport {
  generated_at: string;
  data_map: LgpdDataMapEntry[];
  rights_requests: RightsRequest[];
  consent_log: LgpdConsentLog[];
}

export const lgpdDataMapQueryOptions = () =>
  queryOptions({
    queryKey: ["lgpd-data-map"],
    queryFn: () => request<LgpdDataMapEntry[]>("/lgpd/data-map"),
  });

export const lgpdDataMapByAgentQueryOptions = (agentId: string) =>
  queryOptions({
    queryKey: ["lgpd-data-map", agentId],
    queryFn: () => request<LgpdDataMapEntry[]>(`/lgpd/data-map/${agentId}`),
  });

export const lgpdRightsRequestsQueryOptions = (filters?: RightsRequestFilters) =>
  queryOptions({
    queryKey: ["lgpd-rights-requests", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set("status", filters.status);
      if (filters?.right_type) params.set("right_type", filters.right_type);
      const qs = params.toString();
      return request<RightsRequest[]>(`/lgpd/rights-requests${qs ? `?${qs}` : ""}`);
    },
  });

export const lgpdConsentLogQueryOptions = (filters?: ConsentLogFilters) =>
  queryOptions({
    queryKey: ["lgpd-consent-log", filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters?.agentId) params.set("agentId", filters.agentId);
      if (filters?.userRef) params.set("userRef", filters.userRef);
      if (filters?.from) params.set("from", filters.from);
      if (filters?.to) params.set("to", filters.to);
      const qs = params.toString();
      return request<LgpdConsentLog[]>(`/lgpd/consent-log${qs ? `?${qs}` : ""}`);
    },
  });

export async function putLgpdDataMap(agentId: string, entries: Array<{
  data_type: string;
  label: string;
  purpose: string;
  legal_basis: string;
  retention_days?: number | null;
}>): Promise<LgpdDataMapEntry[]> {
  return request<LgpdDataMapEntry[]>(`/lgpd/data-map/${agentId}`, {
    method: "PUT",
    body: JSON.stringify(entries),
  });
}

export async function createRightsRequest(payload: {
  user_ref: string;
  right_type: string;
  agent_id?: string;
  description?: string;
}): Promise<RightsRequest> {
  return request<RightsRequest>("/lgpd/rights-requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateRightsRequest(id: string, payload: {
  status?: string;
  response?: string;
}): Promise<RightsRequest> {
  return request<RightsRequest>(`/lgpd/rights-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function generateLgpdReport(): Promise<LgpdReport> {
  return request<LgpdReport>("/lgpd/report", { method: "POST" });
}

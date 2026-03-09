import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface OTelConfig {
  enabled: boolean;
  endpoint: string;
  headers: Record<string, string>;
  samplingRate: number;
  agentFilter: string[];
  operationFilter: string[];
}

export interface OTelStatus {
  connected: boolean;
  spansExported: number;
  errors: number;
  lastExportAt: string | null;
}

export interface OTelTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export function otelConfigQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "otel"],
    queryFn: () => request<OTelConfig>("/settings/otel"),
  });
}

export function otelStatusQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "otel", "status"],
    queryFn: () => request<OTelStatus>("/settings/otel/status"),
    refetchInterval: 30_000,
  });
}

export function updateOTelConfig(config: OTelConfig) {
  return request<OTelConfig>("/settings/otel", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function testOTelConnection() {
  return request<OTelTestResult>("/settings/otel/test", {
    method: "POST",
  });
}

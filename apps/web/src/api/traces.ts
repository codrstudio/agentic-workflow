import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface TraceStep {
  index: number;
  type: "text" | "tool_call" | "tool_result";
  timestamp: string;
  durationMs: number;
  tokensIn?: number;
  tokensOut?: number;
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
}

export interface Trace {
  id: string;
  agentId: string;
  type: "heartbeat" | "conversation" | "cron";
  startedAt: string;
  durationMs: number;
  totalTokensIn: number;
  totalTokensOut: number;
  costUsd: number;
  model: string;
  steps: TraceStep[];
}

export type TraceType = "heartbeat" | "conversation" | "cron";

export function traceQueryOptions(params: {
  type: TraceType;
  id: string;
}) {
  return queryOptions({
    queryKey: ["traces", params.type, params.id],
    queryFn: () => request<Trace>(`/traces/${params.type}/${params.id}`),
  });
}

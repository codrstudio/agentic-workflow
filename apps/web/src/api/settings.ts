import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

export interface SlugDef {
  slug: string;
  class: string;
  effort: string;
  llm: { model: string; parameters: Record<string, unknown> };
  tags: string[];
  title: string;
  description: string;
}

export interface LlmPlan {
  name: string;
  title: string;
  description: string;
  slugs: Record<string, SlugDef>;
  roles: Record<string, string>;
}

export interface LlmConfig {
  activePlan: string;
  plans: LlmPlan[];
}

export function llmSettingsQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "llm"],
    queryFn: () => request<LlmConfig>("/settings/llm"),
  });
}

export function activateLlmPlan(activePlan: string) {
  return request<LlmConfig>("/settings/llm", {
    method: "PATCH",
    body: JSON.stringify({ activePlan }),
  });
}

export type WebSearchProvider = "duckduckgo" | "brave" | "none";

export interface WebSearchConfig {
  provider: WebSearchProvider;
}

export function webSearchSettingsQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "web-search"],
    queryFn: () => request<WebSearchConfig>("/settings/web-search"),
  });
}

export function updateWebSearchProvider(provider: WebSearchProvider) {
  return request<WebSearchConfig>("/settings/web-search", {
    method: "PATCH",
    body: JSON.stringify({ provider }),
  });
}

export interface SystemInfo {
  version: string;
  nodeVersion: string;
  platform: string;
  contextDir: string;
}

export interface SystemEnv {
  OPENROUTER_API_KEY: boolean;
  OPENAI_API_KEY: boolean;
  BACKBONE_PORT: string;
  NODE_ENV: string;
}

export function systemInfoQueryOptions() {
  return queryOptions({
    queryKey: ["system", "info"],
    queryFn: () => request<SystemInfo>("/system/info"),
  });
}

export function systemEnvQueryOptions() {
  return queryOptions({
    queryKey: ["system", "env"],
    queryFn: () => request<SystemEnv>("/system/env"),
  });
}

// ── Routing ──────────────────────────────────────────────────

export interface RoutingConditions {
  mode?: string;
  prompt_tokens_lte?: number;
  prompt_tokens_gte?: number;
  tools_count_gte?: number;
  tools_count_lte?: number;
  tags_any?: string[];
  channel_type?: string;
}

export interface RoutingRule {
  id: string;
  description?: string;
  conditions: RoutingConditions;
  model: string;
  priority: number;
}

export interface RoutingConfig {
  enabled: boolean;
  rules: RoutingRule[];
}

export interface RoutingStats {
  agentId: string;
  period: { from: string; to: string };
  totalExecutions: number;
  modelDistribution: Record<string, { count: number; pct: number }>;
  estimatedSavings: {
    without_routing_usd: number;
    with_routing_usd: number;
    saved_usd: number;
    saved_pct: number;
  };
  ruleHits: Record<string, number>;
  globalRoutingEnabled: boolean;
}

export interface SimulateRoutingRequest {
  agentId?: string;
  mode: string;
  estimatedPromptTokens?: number;
  toolsCount?: number;
  channelType?: string;
  tags?: string[];
  role?: string;
}

export interface SimulateRoutingResponse {
  selectedModel: string;
  matchedRule: string | null;
  fallback: boolean;
}

export function routingConfigQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "routing"],
    queryFn: () => request<RoutingConfig>("/settings/routing"),
  });
}

export function updateRoutingConfig(config: RoutingConfig) {
  return request<RoutingConfig>("/settings/routing", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export function agentRoutingStatsQueryOptions(
  agentId: string,
  params?: { from?: string; to?: string },
) {
  const search = new URLSearchParams();
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const qs = search.toString() ? `?${search.toString()}` : "";
  return queryOptions({
    queryKey: ["agents", agentId, "routing-stats", params],
    queryFn: () => request<RoutingStats>(`/agents/${agentId}/routing-stats${qs}`),
  });
}

export function simulateRouting(body: SimulateRoutingRequest) {
  return request<SimulateRoutingResponse>("/settings/routing/simulate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

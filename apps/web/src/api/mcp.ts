import { queryOptions } from "@tanstack/react-query";
import { request } from "@/lib/api";

// ---- MCP Tools for an agent ----

export interface McpTool {
  name: string;
  prefixedName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpServer {
  adapterSlug: string;
  serverLabel: string;
  transport: string;
  connected: boolean;
  tools: McpTool[];
}

export interface AgentMcpTools {
  agentId: string;
  servers: McpServer[];
  totalTools: number;
}

export function agentMcpToolsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["agents", agentId, "mcp-tools"],
    queryFn: () => request<AgentMcpTools>(`/agents/${agentId}/mcp-tools`),
  });
}

// ---- MCP Call history ----

export interface McpCall {
  id: string;
  agentId: string;
  adapterId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  error: string | null;
  durationMs: number | null;
  calledAt: string;
}

export interface AgentMcpCalls {
  agentId: string;
  calls: McpCall[];
  total: number;
  limit: number;
  offset: number;
}

export function agentMcpCallsQueryOptions(agentId: string) {
  return queryOptions({
    queryKey: ["agents", agentId, "mcp-calls"],
    queryFn: () => request<AgentMcpCalls>(`/agents/${agentId}/mcp-calls?limit=20`),
  });
}

// ---- MCP Server settings ----

export interface McpServerConfig {
  enabled: boolean;
  allowed_agents: string[];
  require_auth: boolean;
}

export function mcpServerConfigQueryOptions() {
  return queryOptions({
    queryKey: ["settings", "mcp-server"],
    queryFn: () => request<McpServerConfig>("/settings/mcp-server"),
  });
}

export function updateMcpServerConfig(config: Partial<McpServerConfig>) {
  return request<McpServerConfig>("/settings/mcp-server", {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

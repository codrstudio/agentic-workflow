import { z } from "zod";

export const McpToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
});

export const MCPServerRegistrySchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string(),
  server_url: z.string(),
  transport: z.enum(["stdio", "sse", "streamable-http"]),
  status: z.enum(["active", "inactive", "error", "deprecated"]).default("active"),
  tools_available: z.array(McpToolSchema).default([]),
  allowed_agents: z.array(z.string()).default([]),
  requires_approval: z.boolean().default(false),
  cost_per_call_usd: z.number().nullable().default(null),
  monthly_budget_usd: z.number().nullable().default(null),
  current_month_spend_usd: z.number().default(0),
  last_health_check: z.string().nullable().default(null),
  avg_latency_ms: z.number().nullable().default(null),
  error_rate: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const CreateMCPServerRegistrySchema = z.object({
  name: z.string().min(1),
  server_url: z.string().min(1),
  transport: z.enum(["stdio", "sse", "streamable-http"]),
  status: z.enum(["active", "inactive", "error", "deprecated"]).optional(),
  tools_available: z.array(McpToolSchema).optional(),
  allowed_agents: z.array(z.string()).optional(),
  requires_approval: z.boolean().optional(),
  cost_per_call_usd: z.number().nullable().optional(),
  monthly_budget_usd: z.number().nullable().optional(),
});

export const UpdateMCPServerRegistrySchema = z.object({
  name: z.string().min(1).optional(),
  server_url: z.string().min(1).optional(),
  transport: z.enum(["stdio", "sse", "streamable-http"]).optional(),
  status: z.enum(["active", "inactive", "error", "deprecated"]).optional(),
  tools_available: z.array(McpToolSchema).optional(),
  allowed_agents: z.array(z.string()).optional(),
  requires_approval: z.boolean().optional(),
  cost_per_call_usd: z.number().nullable().optional(),
  monthly_budget_usd: z.number().nullable().optional(),
  current_month_spend_usd: z.number().optional(),
  error_rate: z.number().optional(),
});

export type MCPServerRegistry = z.infer<typeof MCPServerRegistrySchema>;
export type McpTool = z.infer<typeof McpToolSchema>;

// --- MCP Audit Log ---

export const MCPAuditLogStatusEnum = z.enum(["success", "error", "denied", "timeout"]);

export const MCPAuditLogSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  server_id: z.string().uuid(),
  server_name: z.string(),
  tool_name: z.string(),
  agent_type: z.string(),
  session_id: z.string().nullable().default(null),
  feature_id: z.string().nullable().default(null),
  status: MCPAuditLogStatusEnum,
  latency_ms: z.number().int(),
  cost_usd: z.number().nullable().default(null),
  input_summary: z.string().nullable().default(null),
  output_summary: z.string().nullable().default(null),
  error_message: z.string().nullable().default(null),
  timestamp: z.string(),
});

export const CreateMCPAuditLogSchema = z.object({
  server_id: z.string().uuid(),
  server_name: z.string(),
  tool_name: z.string(),
  agent_type: z.string(),
  session_id: z.string().nullable().optional(),
  feature_id: z.string().nullable().optional(),
  status: MCPAuditLogStatusEnum,
  latency_ms: z.number().int(),
  cost_usd: z.number().nullable().optional(),
  input_summary: z.string().nullable().optional(),
  output_summary: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
});

export type MCPAuditLog = z.infer<typeof MCPAuditLogSchema>;

// --- MCP Governance Metrics ---

export const MCPServerMetricsSchema = z.object({
  server_id: z.string().uuid(),
  server_name: z.string(),
  calls: z.number().int(),
  cost_usd: z.number(),
  error_rate: z.number(),
  avg_latency_ms: z.number(),
});

export const MCPAgentMetricsSchema = z.object({
  agent_type: z.string(),
  calls: z.number().int(),
  cost_usd: z.number(),
  servers_used: z.array(z.string()),
});

export const MCPTopToolSchema = z.object({
  tool_name: z.string(),
  server_name: z.string(),
  calls: z.number().int(),
  cost_usd: z.number(),
});

export const MCPGovernanceMetricsSchema = z.object({
  total_calls: z.number().int(),
  total_cost_usd: z.number(),
  error_rate: z.number(),
  denied_calls: z.number().int(),
  by_server: z.array(MCPServerMetricsSchema),
  by_agent: z.array(MCPAgentMetricsSchema),
  top_tools: z.array(MCPTopToolSchema),
});

export const MCPMetricsCacheSchema = z.object({
  metrics: MCPGovernanceMetricsSchema,
  cached_at: z.string(),
});

export type MCPGovernanceMetrics = z.infer<typeof MCPGovernanceMetricsSchema>;
export type MCPMetricsCache = z.infer<typeof MCPMetricsCacheSchema>;

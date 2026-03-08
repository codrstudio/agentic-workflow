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

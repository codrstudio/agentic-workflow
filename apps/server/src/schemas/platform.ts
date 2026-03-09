import { z } from "zod";

export const PlatformCapabilitySchema = z.object({
  id: z.enum(["pm", "sdd", "review", "security", "context", "metrics", "compliance", "mcp"]),
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "preview", "planned"]),
  module_route: z.string(),
  features_count: z.number().int().nonnegative(),
  replaces: z.array(z.string()),
  estimated_monthly_cost_usd: z.number().nonnegative(),
});

export type PlatformCapability = z.infer<typeof PlatformCapabilitySchema>;

export const ToolReplacedSchema = z.object({
  tool_name: z.string(),
  monthly_cost: z.number().nonnegative(),
  capability_id: z.string(),
});

export const CrossModuleActionSchema = z.object({
  from_module: z.string(),
  to_module: z.string(),
  count: z.number().int().nonnegative(),
});

export const ConsolidationMetricsSchema = z.object({
  capabilities_active: z.number().int().nonnegative(),
  capabilities_total: z.number().int().nonnegative(),
  adoption_rate: z.number().min(0).max(1),
  tools_replaced: z.array(ToolReplacedSchema),
  estimated_monthly_savings_usd: z.number().nonnegative(),
  estimated_annual_savings_usd: z.number().nonnegative(),
  modules_used_today: z.number().int().nonnegative(),
  avg_module_switches_per_day: z.number().nonnegative(),
  cross_module_actions: z.array(CrossModuleActionSchema),
});

export type ConsolidationMetrics = z.infer<typeof ConsolidationMetricsSchema>;

export const TrackUsageBodySchema = z.object({
  module: z.string().min(1),
  action: z.string().min(1),
});

export type TrackUsageBody = z.infer<typeof TrackUsageBodySchema>;

export const UsageEventSchema = z.object({
  module: z.string(),
  action: z.string(),
  timestamp: z.string(),
});

export type UsageEvent = z.infer<typeof UsageEventSchema>;

export const UsageDayFileSchema = z.array(UsageEventSchema);
export type UsageDayFile = z.infer<typeof UsageDayFileSchema>;

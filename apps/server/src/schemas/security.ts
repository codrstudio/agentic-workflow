import { z } from "zod";

// SecurityGateConfig
export const SecurityGateConfigSchema = z.object({
  project_id: z.string().uuid(),
  enabled: z.boolean().default(true),
  block_on_critical: z.boolean().default(true),
  block_on_high: z.boolean().default(true),
  block_on_medium: z.boolean().default(false),
  auto_scan_on_review: z.boolean().default(true),
  scan_model: z.string().default("claude-sonnet-4-5-20250514"),
  updated_at: z.string().datetime(),
});

export type SecurityGateConfig = z.infer<typeof SecurityGateConfigSchema>;

export const PutSecurityGateConfigBody = z.object({
  enabled: z.boolean().optional(),
  block_on_critical: z.boolean().optional(),
  block_on_high: z.boolean().optional(),
  block_on_medium: z.boolean().optional(),
  auto_scan_on_review: z.boolean().optional(),
  scan_model: z.string().optional(),
});

export type PutSecurityGateConfigBody = z.infer<typeof PutSecurityGateConfigBody>;

// SecurityScan
export const ScanTypeEnum = z.enum(["automated", "manual", "review_agent"]);
export type ScanType = z.infer<typeof ScanTypeEnum>;

export const ScanStatusEnum = z.enum(["pending", "running", "completed", "failed"]);
export type ScanStatus = z.infer<typeof ScanStatusEnum>;

export const FindingsCountSchema = z.object({
  critical: z.number().int().default(0),
  high: z.number().int().default(0),
  medium: z.number().int().default(0),
  low: z.number().int().default(0),
  info: z.number().int().default(0),
});

export type FindingsCount = z.infer<typeof FindingsCountSchema>;

export const SecurityScanSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  feature_id: z.string().nullable().default(null),
  scan_type: ScanTypeEnum,
  status: ScanStatusEnum.default("pending"),
  findings_count: FindingsCountSchema,
  triggered_by: z.string(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().nullable().default(null),
});

export type SecurityScan = z.infer<typeof SecurityScanSchema>;

export const CreateSecurityScanBody = z.object({
  feature_id: z.string().nullable().optional(),
  scan_type: ScanTypeEnum,
  triggered_by: z.string(),
});

export type CreateSecurityScanBody = z.infer<typeof CreateSecurityScanBody>;

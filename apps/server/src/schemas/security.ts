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

// SecurityFinding
export const SeverityEnum = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof SeverityEnum>;

export const CategoryEnum = z.enum([
  "injection",
  "auth",
  "data_exposure",
  "xss",
  "insecure_config",
  "hardcoded_secrets",
  "path_traversal",
  "other",
]);
export type Category = z.infer<typeof CategoryEnum>;

export const ResolutionEnum = z.enum(["open", "fixed", "accepted_risk", "false_positive"]);
export type Resolution = z.infer<typeof ResolutionEnum>;

export const SecurityFindingSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  scan_id: z.string().uuid(),
  feature_id: z.string().nullable().default(null),
  severity: SeverityEnum,
  category: CategoryEnum,
  title: z.string(),
  description: z.string(),
  file_path: z.string().nullable().default(null),
  line_number: z.number().int().nullable().default(null),
  suggested_fix: z.string().nullable().default(null),
  resolution: ResolutionEnum.default("open"),
  resolution_note: z.string().nullable().default(null),
  resolved_at: z.string().datetime().nullable().default(null),
  created_at: z.string().datetime(),
});

export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;

export const CreateSecurityFindingBody = z.object({
  scan_id: z.string().uuid(),
  feature_id: z.string().nullable().optional(),
  severity: SeverityEnum,
  category: CategoryEnum,
  title: z.string(),
  description: z.string(),
  file_path: z.string().nullable().optional(),
  line_number: z.number().int().nullable().optional(),
  suggested_fix: z.string().nullable().optional(),
});

export type CreateSecurityFindingBody = z.infer<typeof CreateSecurityFindingBody>;

export const PatchSecurityFindingBody = z.object({
  resolution: ResolutionEnum.optional(),
  resolution_note: z.string().nullable().optional(),
}).refine(
  (data) => {
    if (data.resolution === "accepted_risk" && !data.resolution_note) return false;
    return true;
  },
  { message: "resolution_note is required when resolution is accepted_risk" }
);

export type PatchSecurityFindingBody = z.infer<typeof PatchSecurityFindingBody>;

export const GateCheckBody = z.object({
  feature_id: z.string(),
});

export type GateCheckBody = z.infer<typeof GateCheckBody>;

export const GateCheckResponse = z.object({
  passed: z.boolean(),
  blockers: z.array(SecurityFindingSchema),
  summary: z.string(),
});

export type GateCheckResponse = z.infer<typeof GateCheckResponse>;

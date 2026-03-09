import { z } from "zod";

export const ACRStatusEnum = z.enum(["active", "superseded", "deprecated"]);
export type ACRStatus = z.infer<typeof ACRStatusEnum>;

export const ACRCategoryEnum = z.enum([
  "structure",
  "pattern",
  "dependency",
  "technology",
  "security",
  "performance",
  "convention",
  "other",
]);
export type ACRCategory = z.infer<typeof ACRCategoryEnum>;

export const ArchitecturalConstraintRecordSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  slug: z.string().regex(/^ACR-\d{3}$/),
  title: z.string().min(3).max(120),
  category: ACRCategoryEnum,
  status: ACRStatusEnum.default("active"),
  constraint: z.string().min(10),
  rationale: z.string().min(10),
  examples: z
    .object({
      compliant: z.string().optional(),
      non_compliant: z.string().optional(),
    })
    .optional(),
  superseded_by: z.string().uuid().nullable().default(null),
  tags: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type ArchitecturalConstraintRecord = z.infer<
  typeof ArchitecturalConstraintRecordSchema
>;

export const ACRViolationContextEnum = z.enum(["review", "manual", "import"]);
export type ACRViolationContext = z.infer<typeof ACRViolationContextEnum>;

export const ACRViolationResolutionEnum = z.enum([
  "open",
  "accepted",
  "fixed",
  "wontfix",
]);
export type ACRViolationResolution = z.infer<typeof ACRViolationResolutionEnum>;

export const ACRViolationSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  acr_id: z.string().uuid(),
  acr_slug: z.string(),
  detected_at: z.string().datetime(),
  context: ACRViolationContextEnum,
  description: z.string().min(1),
  artifact_id: z.string().uuid().nullable().default(null),
  feature_id: z.string().nullable().default(null),
  resolution: ACRViolationResolutionEnum.default("open"),
  resolution_note: z.string().optional(),
  resolved_at: z.string().datetime().nullable().default(null),
});

export type ACRViolation = z.infer<typeof ACRViolationSchema>;

export const ACRIndexSchema = z.object({
  slugs: z.array(z.string()),
  next_number: z.number().int().positive(),
});

export type ACRIndex = z.infer<typeof ACRIndexSchema>;

export const CreateACRBody = z.object({
  title: z.string().min(3).max(120),
  category: ACRCategoryEnum,
  status: ACRStatusEnum.optional(),
  constraint: z.string().min(10),
  rationale: z.string().min(10),
  examples: z
    .object({
      compliant: z.string().optional(),
      non_compliant: z.string().optional(),
    })
    .optional(),
  superseded_by: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateACRBody = z.infer<typeof CreateACRBody>;

export const PatchACRBody = z.object({
  title: z.string().min(3).max(120).optional(),
  category: ACRCategoryEnum.optional(),
  status: ACRStatusEnum.optional(),
  constraint: z.string().min(10).optional(),
  rationale: z.string().min(10).optional(),
  examples: z
    .object({
      compliant: z.string().optional(),
      non_compliant: z.string().optional(),
    })
    .optional(),
  superseded_by: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export type PatchACRBody = z.infer<typeof PatchACRBody>;

export const CreateViolationBody = z.object({
  context: ACRViolationContextEnum,
  description: z.string().min(1),
  artifact_id: z.string().uuid().nullable().optional(),
  feature_id: z.string().nullable().optional(),
  resolution: ACRViolationResolutionEnum.optional(),
  resolution_note: z.string().optional(),
});

export type CreateViolationBody = z.infer<typeof CreateViolationBody>;

export const PatchViolationBody = z.object({
  resolution: ACRViolationResolutionEnum.optional(),
  resolution_note: z.string().optional(),
});

export type PatchViolationBody = z.infer<typeof PatchViolationBody>;

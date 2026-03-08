import { z } from "zod";

export const SpecStatusEnum = z.enum([
  "draft",
  "review",
  "approved",
  "implementing",
  "completed",
  "superseded",
]);
export type SpecStatus = z.infer<typeof SpecStatusEnum>;

export const SpecSectionSchema = z.object({
  title: z.string(),
  anchor: z.string(),
  content: z.string(),
});

export const SpecDocumentSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  slug: z.string().regex(/^S-\d{3,}$/),
  title: z.string().min(1),
  status: SpecStatusEnum.default("draft"),
  version: z.number().int().positive().default(1),
  content_md: z.string().default(""),
  sections: z.array(SpecSectionSchema).default([]),
  discoveries: z.array(z.string()).default([]),
  derived_features: z.array(z.string()).default([]),
  review_score: z.number().nullable().default(null),
  reviewed_by: z.array(z.string()).default([]),
  superseded_by: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type SpecDocument = z.infer<typeof SpecDocumentSchema>;

export const SpecIndexSchema = z.object({
  slugs: z.array(z.string()).default([]),
  next_number: z.number().int().positive().default(1),
});

export type SpecIndex = z.infer<typeof SpecIndexSchema>;

export const CreateSpecDocumentBody = z.object({
  title: z.string().min(1),
  status: SpecStatusEnum.optional(),
  content_md: z.string().optional(),
  sections: z
    .array(
      z.object({
        title: z.string(),
        anchor: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  discoveries: z.array(z.string()).optional(),
  derived_features: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateSpecDocumentBody = z.infer<typeof CreateSpecDocumentBody>;

export const PatchSpecDocumentBody = z.object({
  title: z.string().min(1).optional(),
  status: SpecStatusEnum.optional(),
  content_md: z.string().optional(),
  sections: z
    .array(
      z.object({
        title: z.string(),
        anchor: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  discoveries: z.array(z.string()).optional(),
  derived_features: z.array(z.string()).optional(),
  review_score: z.number().nullable().optional(),
  reviewed_by: z.array(z.string()).optional(),
  superseded_by: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export type PatchSpecDocumentBody = z.infer<typeof PatchSpecDocumentBody>;

// SpecReviewResult

export const ReviewVerdictEnum = z.enum(["approve", "request_changes", "reject"]);
export type ReviewVerdict = z.infer<typeof ReviewVerdictEnum>;

export const CommentSeverityEnum = z.enum(["blocker", "suggestion", "praise"]);
export type CommentSeverity = z.infer<typeof CommentSeverityEnum>;

export const ReviewCommentSchema = z.object({
  section_anchor: z.string(),
  comment: z.string(),
  severity: CommentSeverityEnum,
});

export const SpecReviewResultSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  spec_id: z.string().uuid(),
  reviewer: z.string().min(1),
  score: z.number().int().min(0).max(100),
  verdict: ReviewVerdictEnum,
  comments: z.array(ReviewCommentSchema).default([]),
  created_at: z.string().datetime(),
});

export type SpecReviewResult = z.infer<typeof SpecReviewResultSchema>;

export const CreateSpecReviewBody = z.object({
  reviewer: z.string().min(1),
  score: z.number().int().min(0).max(100),
  verdict: ReviewVerdictEnum,
  comments: z
    .array(
      z.object({
        section_anchor: z.string(),
        comment: z.string(),
        severity: CommentSeverityEnum,
      })
    )
    .optional(),
});

export type CreateSpecReviewBody = z.infer<typeof CreateSpecReviewBody>;

export const TriggerReviewBody = z.object({
  agents: z.array(z.string().min(1)).default(["reviewer"]),
});

export type TriggerReviewBody = z.infer<typeof TriggerReviewBody>;

// SpecCoverageReport

export const SpecCoverageReportSchema = z.object({
  total_specs: z.number().int().nonnegative(),
  specs_by_status: z.record(z.string(), z.number()),
  total_discoveries: z.number().int().nonnegative(),
  discoveries_covered: z.number().int().nonnegative(),
  discoveries_uncovered: z.array(z.string()),
  coverage_ratio: z.number(),
  specs_without_features: z.array(z.string()),
  features_without_spec: z.array(z.string()),
  avg_review_score: z.number(),
  specs_not_reviewed: z.array(z.string()),
  computed_at: z.string().datetime(),
});

export type SpecCoverageReport = z.infer<typeof SpecCoverageReportSchema>;

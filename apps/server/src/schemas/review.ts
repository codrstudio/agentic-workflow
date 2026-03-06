import { z } from "zod";

export const ReviewItemSchema = z.object({
  id: z.string().uuid(),
  file_path: z.string(),
  diff_type: z.enum(["added", "modified", "deleted"]),
  status: z.enum(["pending", "approved", "flagged"]).default("pending"),
  comment: z.string().optional(),
});

export type ReviewItem = z.infer<typeof ReviewItemSchema>;

export const ReviewCriterionSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  checked: z.boolean().default(false),
});

export type ReviewCriterion = z.infer<typeof ReviewCriterionSchema>;

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  title: z.string(),
  status: z
    .enum(["pending", "in_review", "approved", "changes_requested"])
    .default("pending"),
  chat_session_id: z.string().optional(),
  step_ref: z.string().optional(),
  items: z.array(ReviewItemSchema).default([]),
  criteria: z.array(ReviewCriterionSchema).default([]),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type Review = z.infer<typeof ReviewSchema>;

export const CreateReviewBody = z.object({
  title: z.string().min(1).max(200),
  chat_session_id: z.string().optional(),
  step_ref: z.string().optional(),
});

export const UpdateReviewBody = z.object({
  status: z
    .enum(["pending", "in_review", "approved", "changes_requested"])
    .optional(),
  criteria: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        label: z.string(),
        checked: z.boolean().default(false),
      })
    )
    .optional(),
});

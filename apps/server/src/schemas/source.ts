import { z } from "zod";

export const SourceTypeEnum = z.enum([
  "markdown",
  "text",
  "pdf",
  "url",
  "code",
]);

export const SourceSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  type: SourceTypeEnum,
  content: z.string().optional(),
  file_path: z.string().optional(),
  url: z.string().url().optional(),
  size_bytes: z.number().int().min(0),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  tags: z.array(z.string()).default([]),
});

export type Source = z.infer<typeof SourceSchema>;

export const CreateSourceBody = z.object({
  name: z.string().min(1).max(200),
  type: SourceTypeEnum,
  content: z.string().optional(),
  url: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateSourceBody = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

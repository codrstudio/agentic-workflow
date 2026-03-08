import { z } from "zod";

export const GraphContextSnapshotSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string().uuid(),
  source_id: z.string().uuid(),
  feature_id: z.string().nullable().default(null),
  query: z.string().min(1),
  context_markdown: z.string(),
  nodes_retrieved: z.number().int().min(0),
  generated_at: z.string().datetime(),
  ttl_seconds: z.number().int().default(3600),
});

export type GraphContextSnapshot = z.infer<typeof GraphContextSnapshotSchema>;

export const CreateContextBody = z.object({
  query: z.string().min(1).max(2000),
  feature_id: z.string().optional(),
});

export type CreateContextBody = z.infer<typeof CreateContextBody>;

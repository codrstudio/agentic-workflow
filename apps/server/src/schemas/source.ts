import { z } from "zod";

export const SourceTypeEnum = z.enum([
  "markdown",
  "text",
  "pdf",
  "url",
  "code",
  "codebase_graph",
]);

export const SourceCategoryEnum = z.enum([
  "general",
  "frontend",
  "backend",
  "business",
  "reference",
  "config",
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
  category: SourceCategoryEnum.default("general"),
  pinned: z.boolean().default(false),
  auto_include: z.boolean().default(false),
  relevance_tags: z.array(z.string()).default([]),
});

export type Source = z.infer<typeof SourceSchema>;

export const CreateSourceBody = z.object({
  name: z.string().min(1).max(200),
  type: SourceTypeEnum,
  content: z.string().optional(),
  url: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
  graph_config: z.object({
    provider: z.enum(["gitnexus", "graphiti", "custom_mcp"]),
    mcp_server_url: z.string().url(),
    mcp_auth_token: z.string().optional(),
    mcp_tools: z.array(z.string()).optional(),
    repo_path: z.string().optional(),
    index_patterns: z.array(z.string()).optional(),
    exclude_patterns: z.array(z.string()).optional(),
    auto_reindex_on_merge: z.boolean().optional(),
  }).optional(),
});

export const UpdateSourceBody = z.object({
  name: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  category: SourceCategoryEnum.optional(),
  pinned: z.boolean().optional(),
  auto_include: z.boolean().optional(),
  relevance_tags: z.array(z.string()).optional(),
});

import { z } from "zod";

export const CodebaseGraphProviderEnum = z.enum([
  "gitnexus",
  "graphiti",
  "custom_mcp",
]);
export type CodebaseGraphProvider = z.infer<typeof CodebaseGraphProviderEnum>;

export const CodebaseGraphIndexStatusEnum = z.enum([
  "idle",
  "indexing",
  "ready",
  "error",
]);
export type CodebaseGraphIndexStatus = z.infer<typeof CodebaseGraphIndexStatusEnum>;

export const CodebaseGraphConfigSchema = z.object({
  source_id: z.string().uuid(),
  project_id: z.string().uuid(),
  provider: CodebaseGraphProviderEnum,
  mcp_server_url: z.string().url(),
  mcp_auth_token: z.string().optional(),
  mcp_tools: z.array(z.string()).default([]),
  repo_path: z.string().optional(),
  index_patterns: z
    .array(z.string())
    .default(["**/*.ts", "**/*.tsx", "**/*.js"]),
  exclude_patterns: z
    .array(z.string())
    .default(["node_modules/**", "dist/**"]),
  auto_reindex_on_merge: z.boolean().default(true),
  last_indexed_at: z.string().datetime().nullable().default(null),
  index_status: CodebaseGraphIndexStatusEnum.default("idle"),
  index_error: z.string().nullable().default(null),
  node_count: z.number().int().nullable().default(null),
  edge_count: z.number().int().nullable().default(null),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type CodebaseGraphConfig = z.infer<typeof CodebaseGraphConfigSchema>;

export const CreateCodebaseGraphConfigBody = z.object({
  provider: CodebaseGraphProviderEnum,
  mcp_server_url: z.string().url(),
  mcp_auth_token: z.string().optional(),
  mcp_tools: z.array(z.string()).optional(),
  repo_path: z.string().optional(),
  index_patterns: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
  auto_reindex_on_merge: z.boolean().optional(),
});

export type CreateCodebaseGraphConfigBody = z.infer<
  typeof CreateCodebaseGraphConfigBody
>;

export const PatchCodebaseGraphConfigBody = z.object({
  mcp_server_url: z.string().url().optional(),
  mcp_auth_token: z.string().optional(),
  mcp_tools: z.array(z.string()).optional(),
  repo_path: z.string().optional(),
  index_patterns: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
  auto_reindex_on_merge: z.boolean().optional(),
});

export type PatchCodebaseGraphConfigBody = z.infer<
  typeof PatchCodebaseGraphConfigBody
>;

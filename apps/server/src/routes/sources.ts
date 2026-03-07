import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateSourceBody,
  UpdateSourceBody,
  type Source,
} from "../schemas/source.js";
import { type Project } from "../schemas/project.js";
import {
  CodebaseGraphConfigSchema,
  PatchCodebaseGraphConfigBody,
  type CodebaseGraphConfig,
} from "../schemas/codebase-graph-config.js";

const sources = new Hono();

const INLINE_THRESHOLD = 50 * 1024; // 50KB
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS: Record<string, Source["type"]> = {
  ".md": "markdown",
  ".txt": "text",
  ".pdf": "pdf",
};

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function sourcesJsonPath(slug: string): string {
  return path.join(projectDir(slug), "sources", "sources.json");
}

function filesDir(slug: string): string {
  return path.join(projectDir(slug), "sources", "files");
}

function graphConfigsDir(slug: string): string {
  return path.join(projectDir(slug), "codebase-graph-configs");
}

function graphConfigPath(slug: string, sourceId: string): string {
  return path.join(graphConfigsDir(slug), `${sourceId}.json`);
}

async function loadGraphConfig(
  slug: string,
  sourceId: string
): Promise<CodebaseGraphConfig | null> {
  try {
    return await readJSON<CodebaseGraphConfig>(graphConfigPath(slug, sourceId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveGraphConfig(
  slug: string,
  config_: CodebaseGraphConfig
): Promise<void> {
  await ensureDir(graphConfigsDir(slug));
  await writeJSON(graphConfigPath(slug, config_.source_id), config_);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json")
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function applySourceDefaults(source: Record<string, unknown>): Source {
  return {
    ...source,
    category: source.category ?? "general",
    pinned: source.pinned ?? false,
    auto_include: source.auto_include ?? false,
    relevance_tags: source.relevance_tags ?? [],
  } as Source;
}

async function loadSources(slug: string): Promise<Source[]> {
  try {
    const raw = await readJSON<Record<string, unknown>[]>(sourcesJsonPath(slug));
    return raw.map(applySourceDefaults);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveSources(slug: string, data: Source[]): Promise<void> {
  await writeJSON(sourcesJsonPath(slug), data);
}

function extensionForType(type: string): string {
  switch (type) {
    case "markdown":
      return "md";
    case "code":
      return "txt";
    case "text":
      return "txt";
    default:
      return "txt";
  }
}

async function loadContentForSource(
  slug: string,
  source: Source
): Promise<string | undefined> {
  if (source.content !== undefined) return source.content;
  if (source.file_path) {
    const fullPath = path.join(projectDir(slug), "sources", source.file_path);
    try {
      return await readFile(fullPath, "utf-8");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// GET /hub/projects/:slug/sources — list sources (no content)
sources.get("/hub/projects/:slug/sources", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadSources(slug);

  // Apply filters
  const typeFilter = c.req.query("type");
  const tagFilter = c.req.query("tag");

  let filtered = all;
  if (typeFilter) {
    filtered = filtered.filter((s) => s.type === typeFilter);
  }
  if (tagFilter) {
    filtered = filtered.filter((s) => s.tags.includes(tagFilter));
  }

  // Strip content for list response
  const result = filtered.map(({ content, ...rest }) => rest);

  return c.json(result);
});

// GET /hub/projects/:slug/sources/:id — get source with content
sources.get("/hub/projects/:slug/sources/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadSources(slug);
  const source = all.find((s) => s.id === id);
  if (!source) return c.json({ error: "Source not found" }, 404);

  const content = await loadContentForSource(slug, source);
  return c.json({ ...source, content });
});

// POST /hub/projects/:slug/sources — create source
sources.post("/hub/projects/:slug/sources", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateSourceBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { name, type, content, url, tags, graph_config } = parsed.data;

  // Validate codebase_graph requires graph_config
  if (type === "codebase_graph" && !graph_config) {
    return c.json(
      { error: "graph_config is required when type=codebase_graph" },
      400
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  let inlineContent: string | undefined;
  let filePath: string | undefined;
  let sizeBytes = 0;

  if (type !== "codebase_graph") {
    const contentStr = content ?? "";
    sizeBytes = Buffer.byteLength(contentStr, "utf-8");

    if (sizeBytes > INLINE_THRESHOLD) {
      const ext = extensionForType(type);
      const fileName = `${id}.${ext}`;
      filePath = `files/${fileName}`;
      const dir = filesDir(slug);
      await ensureDir(dir);
      await writeFile(path.join(dir, fileName), contentStr, "utf-8");
    } else {
      inlineContent = contentStr;
    }
  }

  const source: Source = {
    id,
    project_id: project.id,
    name,
    type,
    content: inlineContent,
    file_path: filePath,
    url,
    size_bytes: sizeBytes,
    created_at: now,
    updated_at: now,
    tags,
    category: "general",
    pinned: false,
    auto_include: false,
    relevance_tags: [],
  };

  const all = await loadSources(slug);
  all.push(source);
  await saveSources(slug, all);

  // Create CodebaseGraphConfig for codebase_graph sources
  if (type === "codebase_graph" && graph_config) {
    const graphCfg: CodebaseGraphConfig = CodebaseGraphConfigSchema.parse({
      source_id: id,
      project_id: project.id,
      provider: graph_config.provider,
      mcp_server_url: graph_config.mcp_server_url,
      mcp_auth_token: graph_config.mcp_auth_token,
      mcp_tools: graph_config.mcp_tools ?? [],
      repo_path: graph_config.repo_path,
      index_patterns: graph_config.index_patterns ?? ["**/*.ts", "**/*.tsx", "**/*.js"],
      exclude_patterns: graph_config.exclude_patterns ?? ["node_modules/**", "dist/**"],
      auto_reindex_on_merge: graph_config.auto_reindex_on_merge ?? true,
      last_indexed_at: null,
      index_status: "idle",
      index_error: null,
      node_count: null,
      edge_count: null,
      created_at: now,
      updated_at: now,
    });
    await saveGraphConfig(slug, graphCfg);
    return c.json({ ...source, graph_config: graphCfg }, 201);
  }

  return c.json(source, 201);
});

// POST /hub/projects/:slug/sources/upload — upload file source
sources.post("/hub/projects/:slug/sources/upload", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!file || !(file instanceof File)) {
    return c.json({ error: "Missing file field" }, 400);
  }

  // Check file size
  if (file.size > MAX_UPLOAD_SIZE) {
    return c.json({ error: "Payload Too Large" }, 413);
  }

  // Check extension
  const originalName = file.name;
  const extMatch = originalName.match(/(\.[^.]+)$/);
  const ext = extMatch ? extMatch[1]!.toLowerCase() : "";
  const sourceType = ALLOWED_EXTENSIONS[ext];

  if (!sourceType) {
    return c.json(
      { error: `Unsupported file extension: ${ext || "(none)"}. Allowed: .md, .txt, .pdf` },
      400
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const fileName = `${id}${ext}`;
  const filePath = `files/${fileName}`;

  // Ensure files directory exists and write file
  const dir = filesDir(slug);
  await ensureDir(dir);

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(path.join(dir, fileName), buffer);

  const source: Source = {
    id,
    project_id: project.id,
    name: originalName,
    type: sourceType,
    content: undefined,
    file_path: filePath,
    url: undefined,
    size_bytes: file.size,
    created_at: now,
    updated_at: now,
    tags: [],
    category: "general",
    pinned: false,
    auto_include: false,
    relevance_tags: [],
  };

  // Parse optional tags from form body
  const tagsRaw = body["tags"];
  if (typeof tagsRaw === "string" && tagsRaw.trim()) {
    try {
      const parsed = JSON.parse(tagsRaw);
      if (Array.isArray(parsed)) {
        source.tags = parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      // ignore invalid tags JSON
    }
  }

  const all = await loadSources(slug);
  all.push(source);
  await saveSources(slug, all);

  return c.json(source, 201);
});

// PATCH /hub/projects/:slug/sources/:id — update source
sources.patch("/hub/projects/:slug/sources/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadSources(slug);
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return c.json({ error: "Source not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = UpdateSourceBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const existing = all[index]!;
  const updates = parsed.data;

  if (updates.name !== undefined) existing.name = updates.name;
  if (updates.tags !== undefined) existing.tags = updates.tags;
  if (updates.category !== undefined) existing.category = updates.category;
  if (updates.pinned !== undefined) existing.pinned = updates.pinned;
  if (updates.auto_include !== undefined) existing.auto_include = updates.auto_include;
  if (updates.relevance_tags !== undefined) existing.relevance_tags = updates.relevance_tags;

  if (updates.content !== undefined) {
    const sizeBytes = Buffer.byteLength(updates.content, "utf-8");
    existing.size_bytes = sizeBytes;

    // Remove old file if it was stored externally
    if (existing.file_path) {
      const oldPath = path.join(
        projectDir(slug),
        "sources",
        existing.file_path
      );
      try {
        await unlink(oldPath);
      } catch {
        // ignore if already gone
      }
    }

    if (sizeBytes > INLINE_THRESHOLD) {
      const ext = extensionForType(existing.type);
      const fileName = `${existing.id}.${ext}`;
      existing.file_path = `files/${fileName}`;
      existing.content = undefined;
      const dir = filesDir(slug);
      await ensureDir(dir);
      await writeFile(path.join(dir, fileName), updates.content, "utf-8");
    } else {
      existing.content = updates.content;
      existing.file_path = undefined;
    }
  }

  existing.updated_at = new Date().toISOString();
  all[index] = existing;
  await saveSources(slug, all);

  // Return with content loaded
  const content = await loadContentForSource(slug, existing);
  return c.json({ ...existing, content });
});

// DELETE /hub/projects/:slug/sources/:id — delete source
sources.delete("/hub/projects/:slug/sources/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadSources(slug);
  const index = all.findIndex((s) => s.id === id);
  if (index === -1) return c.json({ error: "Source not found" }, 404);

  const source = all[index]!;

  // Remove file if stored externally
  if (source.file_path) {
    const fullPath = path.join(projectDir(slug), "sources", source.file_path);
    try {
      await unlink(fullPath);
    } catch {
      // ignore
    }
  }

  all.splice(index, 1);
  await saveSources(slug, all);

  return c.body(null, 204);
});

// GET /hub/projects/:slug/sources/:id/graph-config — get codebase graph config
sources.get("/hub/projects/:slug/sources/:id/graph-config", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadSources(slug);
  const source = all.find((s) => s.id === id);
  if (!source) return c.json({ error: "Source not found" }, 404);
  if (source.type !== "codebase_graph") {
    return c.json({ error: "Source is not of type codebase_graph" }, 400);
  }

  const graphCfg = await loadGraphConfig(slug, id);
  if (!graphCfg) return c.json({ error: "Graph config not found" }, 404);

  return c.json(graphCfg);
});

// PATCH /hub/projects/:slug/sources/:id/graph-config — update codebase graph config
sources.patch("/hub/projects/:slug/sources/:id/graph-config", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadSources(slug);
  const source = all.find((s) => s.id === id);
  if (!source) return c.json({ error: "Source not found" }, 404);
  if (source.type !== "codebase_graph") {
    return c.json({ error: "Source is not of type codebase_graph" }, 400);
  }

  const existing = await loadGraphConfig(slug, id);
  if (!existing) return c.json({ error: "Graph config not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchCodebaseGraphConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const updates = parsed.data;
  if (updates.mcp_server_url !== undefined) existing.mcp_server_url = updates.mcp_server_url;
  if (updates.mcp_auth_token !== undefined) existing.mcp_auth_token = updates.mcp_auth_token;
  if (updates.mcp_tools !== undefined) existing.mcp_tools = updates.mcp_tools;
  if (updates.repo_path !== undefined) existing.repo_path = updates.repo_path;
  if (updates.index_patterns !== undefined) existing.index_patterns = updates.index_patterns;
  if (updates.exclude_patterns !== undefined) existing.exclude_patterns = updates.exclude_patterns;
  if (updates.auto_reindex_on_merge !== undefined) existing.auto_reindex_on_merge = updates.auto_reindex_on_merge;
  existing.updated_at = new Date().toISOString();

  await saveGraphConfig(slug, existing);

  return c.json(existing);
});

export { sources };

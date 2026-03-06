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

const sources = new Hono();

const INLINE_THRESHOLD = 50 * 1024; // 50KB

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function sourcesJsonPath(slug: string): string {
  return path.join(projectDir(slug), "sources", "sources.json");
}

function filesDir(slug: string): string {
  return path.join(projectDir(slug), "sources", "files");
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

async function loadSources(slug: string): Promise<Source[]> {
  try {
    return await readJSON<Source[]>(sourcesJsonPath(slug));
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

  const { name, type, content, url, tags } = parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();
  const contentStr = content ?? "";
  const sizeBytes = Buffer.byteLength(contentStr, "utf-8");

  let inlineContent: string | undefined;
  let filePath: string | undefined;

  if (sizeBytes > INLINE_THRESHOLD) {
    // Store in files/
    const ext = extensionForType(type);
    const fileName = `${id}.${ext}`;
    filePath = `files/${fileName}`;
    const dir = filesDir(slug);
    await ensureDir(dir);
    await writeFile(path.join(dir, fileName), contentStr, "utf-8");
  } else {
    inlineContent = contentStr;
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
  };

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

export { sources };

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateArtifactBody,
  UpdateArtifactBody,
  type Artifact,
} from "../schemas/artifact.js";
import { type Project } from "../schemas/project.js";

const artifacts = new Hono();

const INLINE_THRESHOLD = 50 * 1024; // 50KB

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function artifactsJsonPath(slug: string): string {
  return path.join(projectDir(slug), "artifacts", "artifacts.json");
}

function filesDir(slug: string): string {
  return path.join(projectDir(slug), "artifacts", "files");
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

async function loadArtifacts(slug: string): Promise<Artifact[]> {
  try {
    return await readJSON<Artifact[]>(artifactsJsonPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveArtifacts(
  slug: string,
  data: Artifact[]
): Promise<void> {
  await ensureDir(path.join(projectDir(slug), "artifacts"));
  await writeJSON(artifactsJsonPath(slug), data);
}

function extensionForType(type: string): string {
  switch (type) {
    case "document":
      return "md";
    case "code":
      return "txt";
    case "json":
      return "json";
    case "diagram":
      return "mmd";
    case "config":
      return "yaml";
    default:
      return "txt";
  }
}

async function loadContentForArtifact(
  slug: string,
  artifact: Artifact
): Promise<string | undefined> {
  if (artifact.content !== undefined) return artifact.content;
  if (artifact.file_path) {
    const fullPath = path.join(
      projectDir(slug),
      "artifacts",
      artifact.file_path
    );
    try {
      return await readFile(fullPath, "utf-8");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

// GET /hub/projects/:slug/artifacts — list artifacts (no content)
artifacts.get("/hub/projects/:slug/artifacts", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadArtifacts(slug);

  // Apply filters
  const typeFilter = c.req.query("type");
  const originFilter = c.req.query("origin");
  const tagFilter = c.req.query("tag");

  let filtered = all;
  if (typeFilter) {
    filtered = filtered.filter((a) => a.type === typeFilter);
  }
  if (originFilter) {
    filtered = filtered.filter((a) => a.origin === originFilter);
  }
  if (tagFilter) {
    filtered = filtered.filter((a) => a.tags.includes(tagFilter));
  }

  // Strip content and file_path for list response
  const result = filtered.map(({ content, file_path, ...rest }) => rest);

  return c.json(result);
});

// GET /hub/projects/:slug/artifacts/:id — get artifact with content
artifacts.get("/hub/projects/:slug/artifacts/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadArtifacts(slug);
  const artifact = all.find((a) => a.id === id);
  if (!artifact) return c.json({ error: "Artifact not found" }, 404);

  const content = await loadContentForArtifact(slug, artifact);
  return c.json({ ...artifact, content });
});

// POST /hub/projects/:slug/artifacts — create artifact
artifacts.post("/hub/projects/:slug/artifacts", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateArtifactBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { name, type, origin, content, session_id, step_ref, tags } =
    parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();
  const sizeBytes = Buffer.byteLength(content, "utf-8");

  let inlineContent: string | undefined;
  let filePath: string | undefined;

  if (sizeBytes > INLINE_THRESHOLD) {
    const ext = extensionForType(type);
    const fileName = `${id}.${ext}`;
    filePath = `files/${fileName}`;
    const dir = filesDir(slug);
    await ensureDir(dir);
    await writeFile(path.join(dir, fileName), content, "utf-8");
  } else {
    inlineContent = content;
  }

  const artifact: Artifact = {
    id,
    project_id: project.id,
    name,
    type,
    origin,
    content: inlineContent,
    file_path: filePath,
    session_id,
    step_ref,
    version: 1,
    tags,
    created_at: now,
    updated_at: now,
  };

  const all = await loadArtifacts(slug);
  all.push(artifact);
  await saveArtifacts(slug, all);

  return c.json({ ...artifact, content }, 201);
});

// PATCH /hub/projects/:slug/artifacts/:id — update artifact
artifacts.patch("/hub/projects/:slug/artifacts/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadArtifacts(slug);
  const index = all.findIndex((a) => a.id === id);
  if (index === -1) return c.json({ error: "Artifact not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = UpdateArtifactBody.safeParse(body);
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

    // Remove old file if stored externally
    if (existing.file_path) {
      const oldPath = path.join(
        projectDir(slug),
        "artifacts",
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

    // Increment version when content changes
    existing.version = (existing.version ?? 1) + 1;
  }

  existing.updated_at = new Date().toISOString();
  all[index] = existing;
  await saveArtifacts(slug, all);

  const content = await loadContentForArtifact(slug, existing);
  return c.json({ ...existing, content });
});

// DELETE /hub/projects/:slug/artifacts/:id — delete artifact
artifacts.delete("/hub/projects/:slug/artifacts/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const all = await loadArtifacts(slug);
  const index = all.findIndex((a) => a.id === id);
  if (index === -1) return c.json({ error: "Artifact not found" }, 404);

  const artifact = all[index]!;

  // Remove file if stored externally
  if (artifact.file_path) {
    const fullPath = path.join(
      projectDir(slug),
      "artifacts",
      artifact.file_path
    );
    try {
      await unlink(fullPath);
    } catch {
      // ignore
    }
  }

  all.splice(index, 1);
  await saveArtifacts(slug, all);

  return c.body(null, 204);
});

export { artifacts };

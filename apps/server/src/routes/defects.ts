import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  DefectRecordSchema,
  CreateDefectBody,
  PatchDefectBody,
  type DefectRecord,
} from "../schemas/defect.js";
import { type ArtifactOrigin } from "../schemas/artifact-origin.js";
import { type Project } from "../schemas/project.js";

const defects = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
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

function recordsDir(slug: string): string {
  return path.join(projectDir(slug), "defects", "records");
}

function recordPath(slug: string, id: string): string {
  return path.join(recordsDir(slug), `${id}.json`);
}

async function loadRecord(
  slug: string,
  id: string
): Promise<DefectRecord | null> {
  try {
    return await readJSON<DefectRecord>(recordPath(slug, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadAllRecords(slug: string): Promise<DefectRecord[]> {
  const dir = recordsDir(slug);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const records: DefectRecord[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const record = await readJSON<DefectRecord>(path.join(dir, file));
      records.push(record);
    } catch {
      // skip corrupted files
    }
  }
  return records;
}

async function loadOrigin(
  slug: string,
  artifactId: string
): Promise<ArtifactOrigin | null> {
  try {
    return await readJSON<ArtifactOrigin>(
      path.join(projectDir(slug), "artifact-origins", `${artifactId}.json`)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

// POST /hub/projects/:slug/defects — create defect record
defects.post("/hub/projects/:slug/defects", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateDefectBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const data = parsed.data;

  // Propagation: inherit origin from ArtifactOrigin if source_artifact_id provided
  let resolvedOrigin = data.origin ?? "mixed";
  if (data.source_artifact_id) {
    const artifactOrigin = await loadOrigin(slug, data.source_artifact_id);
    if (artifactOrigin) {
      resolvedOrigin = artifactOrigin.origin;
    }
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  const record: DefectRecord = {
    id,
    project_id: project.id,
    title: data.title,
    description: data.description,
    severity: data.severity,
    origin: resolvedOrigin,
    source_feature_id: data.source_feature_id,
    source_artifact_id: data.source_artifact_id,
    source_session_id: data.source_session_id,
    detected_by: data.detected_by,
    detected_at: now,
    status: "open",
  };

  await ensureDir(recordsDir(slug));
  await writeJSON(recordPath(slug, id), record);

  return c.json(record, 201);
});

// GET /hub/projects/:slug/defects — list defects with filters
defects.get("/hub/projects/:slug/defects", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let records = await loadAllRecords(slug);

  // Apply filters
  const originFilter = c.req.query("origin");
  if (originFilter) {
    records = records.filter((r) => r.origin === originFilter);
  }

  const severityFilter = c.req.query("severity");
  if (severityFilter) {
    records = records.filter((r) => r.severity === severityFilter);
  }

  const statusFilter = c.req.query("status");
  if (statusFilter) {
    records = records.filter((r) => r.status === statusFilter);
  }

  const detectorFilter = c.req.query("detected_by");
  if (detectorFilter) {
    records = records.filter((r) => r.detected_by === detectorFilter);
  }

  // Sort by detected_at descending (most recent first)
  records.sort(
    (a, b) =>
      new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  );

  // Limit
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  if (limit > 0 && records.length > limit) {
    records = records.slice(0, limit);
  }

  return c.json(records);
});

// GET /hub/projects/:slug/defects/:id — get single defect
defects.get("/hub/projects/:slug/defects/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const record = await loadRecord(slug, id);
  if (!record) return c.json({ error: "Defect not found" }, 404);

  return c.json(record);
});

// PATCH /hub/projects/:slug/defects/:id — update defect
defects.patch("/hub/projects/:slug/defects/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const existing = await loadRecord(slug, id);
  if (!existing) return c.json({ error: "Defect not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchDefectBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const updates = parsed.data;
  const updated: DefectRecord = { ...existing };

  if (updates.title !== undefined) updated.title = updates.title;
  if (updates.description !== undefined) updated.description = updates.description;
  if (updates.severity !== undefined) updated.severity = updates.severity;
  if (updates.status !== undefined) {
    updated.status = updates.status;
    // Auto-set resolved_at when status changes to resolved
    if (updates.status === "resolved" && !existing.resolved_at) {
      updated.resolved_at = new Date().toISOString();
    }
  }
  if (updates.resolved_at !== undefined) updated.resolved_at = updates.resolved_at;

  await writeJSON(recordPath(slug, id), updated);

  return c.json(updated);
});

export { defects };

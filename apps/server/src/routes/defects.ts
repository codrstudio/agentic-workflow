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
  type DefectMetrics,
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

// GET /hub/projects/:slug/defects/metrics — compute aggregated defect metrics
defects.get("/hub/projects/:slug/defects/metrics", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const periodDays = parseInt(c.req.query("period_days") ?? "30", 10);
  const now = new Date();
  const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const allRecords = await loadAllRecords(slug);

  // Filter records within period
  const records = allRecords.filter(
    (r) => new Date(r.detected_at).getTime() >= cutoff.getTime()
  );

  // Aggregate by origin
  const defectsByOrigin: Record<string, number> = {};
  for (const r of records) {
    defectsByOrigin[r.origin] = (defectsByOrigin[r.origin] ?? 0) + 1;
  }

  // Aggregate by severity
  const defectsBySeverity: Record<string, number> = {};
  for (const r of records) {
    defectsBySeverity[r.severity] = (defectsBySeverity[r.severity] ?? 0) + 1;
  }

  // Aggregate by detector
  const defectsByDetector: Record<string, number> = {};
  for (const r of records) {
    defectsByDetector[r.detected_by] =
      (defectsByDetector[r.detected_by] ?? 0) + 1;
  }

  // Count artifacts by origin for rate computation
  const originsDir = path.join(projectDir(slug), "artifact-origins");
  let originFiles: string[] = [];
  try {
    originFiles = await readdir(originsDir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== "ENOENT") throw err;
  }

  const artifactsByOrigin: Record<string, number> = {};
  for (const file of originFiles) {
    if (!file.endsWith(".json")) continue;
    try {
      const origin = await readJSON<ArtifactOrigin>(
        path.join(originsDir, file)
      );
      artifactsByOrigin[origin.origin] =
        (artifactsByOrigin[origin.origin] ?? 0) + 1;
    } catch {
      // skip corrupted files
    }
  }

  // Compute rates: defects of origin / total artifacts of that origin
  const aiArtifacts =
    (artifactsByOrigin["ai_generated"] ?? 0) +
    (artifactsByOrigin["ai_assisted"] ?? 0);
  const humanArtifacts = artifactsByOrigin["human_written"] ?? 0;

  const aiDefects =
    (defectsByOrigin["ai_generated"] ?? 0) +
    (defectsByOrigin["ai_assisted"] ?? 0);
  const humanDefects = defectsByOrigin["human_written"] ?? 0;

  const aiDefectRate = aiArtifacts > 0 ? aiDefects / aiArtifacts : 0;
  const humanDefectRate = humanArtifacts > 0 ? humanDefects / humanArtifacts : 0;

  // Compute avg resolution time from resolved defects in period
  const resolvedRecords = records.filter(
    (r) => r.status === "resolved" && r.resolved_at
  );
  let avgResolutionTimeHours = 0;
  if (resolvedRecords.length > 0) {
    const totalMs = resolvedRecords.reduce((sum, r) => {
      const detected = new Date(r.detected_at).getTime();
      const resolved = new Date(r.resolved_at!).getTime();
      return sum + (resolved - detected);
    }, 0);
    avgResolutionTimeHours =
      Math.round((totalMs / resolvedRecords.length / (1000 * 60 * 60)) * 100) /
      100;
  }

  // Open defects count (from all records, not just period)
  const openDefectsCount = allRecords.filter(
    (r) => r.status === "open" || r.status === "in_progress"
  ).length;

  const metrics: DefectMetrics = {
    project_id: project.id,
    computed_at: now.toISOString(),
    period_days: periodDays,
    total_defects: records.length,
    defects_by_origin: defectsByOrigin,
    defects_by_severity: defectsBySeverity,
    defects_by_detector: defectsByDetector,
    ai_defect_rate: Math.round(aiDefectRate * 10000) / 10000,
    human_defect_rate: Math.round(humanDefectRate * 10000) / 10000,
    avg_resolution_time_hours: avgResolutionTimeHours,
    open_defects_count: openDefectsCount,
  };

  // Persist computed metrics
  const metricsPath = path.join(projectDir(slug), "defects", "metrics.json");
  await ensureDir(path.join(projectDir(slug), "defects"));
  await writeJSON(metricsPath, metrics);

  return c.json(metrics);
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

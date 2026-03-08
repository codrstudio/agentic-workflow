import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ROIConfigSchema,
  ROISnapshotSchema,
  PutROIConfigBody,
  CreateROISnapshotBody,
  type ROIConfig,
  type ROISnapshot,
} from "../schemas/roi.js";
import { type Project } from "../schemas/project.js";

const roi = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(path.join(projectDir(slug), "project.json"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function roiConfigPath(slug: string): string {
  return path.join(projectDir(slug), "roi-config.json");
}

function roiSnapshotsDirPath(slug: string): string {
  return path.join(projectDir(slug), "roi-snapshots");
}

function roiSnapshotPath(slug: string, date: string): string {
  return path.join(roiSnapshotsDirPath(slug), `${date}.json`);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadROIConfig(slug: string, projectId: string): Promise<ROIConfig> {
  try {
    return await readJSON<ROIConfig>(roiConfigPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      // Return defaults
      return {
        project_id: projectId,
        developer_hourly_rate_usd: 75,
        baseline_hours_per_feature: 8,
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

// GET /hub/projects/:projectId/roi/config
roi.get("/hub/projects/:projectId/roi/config", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const cfg = await loadROIConfig(slug, project.id);
  return c.json(cfg);
});

// PUT /hub/projects/:projectId/roi/config
roi.put("/hub/projects/:projectId/roi/config", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PutROIConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const existing = await loadROIConfig(slug, project.id);
  const updated: ROIConfig = {
    ...existing,
    ...(parsed.data.developer_hourly_rate_usd !== undefined && {
      developer_hourly_rate_usd: parsed.data.developer_hourly_rate_usd,
    }),
    ...(parsed.data.baseline_hours_per_feature !== undefined && {
      baseline_hours_per_feature: parsed.data.baseline_hours_per_feature,
    }),
    updated_at: new Date().toISOString(),
  };

  const validated = ROIConfigSchema.safeParse(updated);
  if (!validated.success) {
    return c.json({ error: "Config construction failed", details: validated.error.issues }, 500);
  }

  await writeJSON(roiConfigPath(slug), validated.data);
  return c.json(validated.data);
});

// GET /hub/projects/:projectId/roi/snapshots?from=&to=
roi.get("/hub/projects/:projectId/roi/snapshots", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const fromFilter = c.req.query("from");
  const toFilter = c.req.query("to");

  const dir = roiSnapshotsDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      return c.json([]);
    }
    throw err;
  }

  const snapshots: ROISnapshot[] = [];
  for (const file of files) {
    const dateKey = file.replace(".json", "");
    if (fromFilter && dateKey < fromFilter) continue;
    if (toFilter && dateKey > toFilter) continue;
    try {
      const snap = await readJSON<ROISnapshot>(path.join(dir, file));
      snapshots.push(snap);
    } catch {
      // skip malformed
    }
  }

  // Sort by date asc
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  return c.json(snapshots);
});

// POST /hub/projects/:projectId/roi/snapshots
roi.post("/hub/projects/:projectId/roi/snapshots", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateROISnapshotBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const date = parsed.data.date ?? todayDate();
  const id = randomUUID();
  const now = new Date().toISOString();

  const snapshot: ROISnapshot = {
    id,
    project_id: project.id,
    date,
    roi_ratio: parsed.data.roi_ratio,
    cost_per_feature_usd: parsed.data.cost_per_feature_usd,
    first_pass_accuracy: parsed.data.first_pass_accuracy,
    rework_ratio: parsed.data.rework_ratio,
    total_cost_usd: parsed.data.total_cost_usd,
    features_completed: parsed.data.features_completed,
    created_at: now,
  };

  const validated = ROISnapshotSchema.safeParse(snapshot);
  if (!validated.success) {
    return c.json({ error: "Snapshot construction failed", details: validated.error.issues }, 500);
  }

  await ensureDir(roiSnapshotsDirPath(slug));
  await writeJSON(roiSnapshotPath(slug, date), validated.data);

  return c.json(validated.data, 201);
});

export { roi };

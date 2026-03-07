import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateFeatureProductivityBody,
  PatchFeatureProductivityBody,
  type FeatureProductivityRecord,
} from "../schemas/feature-productivity.js";
import { type Project } from "../schemas/project.js";

const productivity = new Hono();

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

function featureRecordPath(slug: string, featureId: string): string {
  return path.join(
    projectDir(slug),
    "productivity",
    "feature-records",
    `${featureId}.json`
  );
}

function featureRecordsDir(slug: string): string {
  return path.join(projectDir(slug), "productivity", "feature-records");
}

async function loadFeatureRecord(
  slug: string,
  featureId: string
): Promise<FeatureProductivityRecord | null> {
  try {
    return await readJSON<FeatureProductivityRecord>(
      featureRecordPath(slug, featureId)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveFeatureRecord(
  slug: string,
  featureId: string,
  record: FeatureProductivityRecord
): Promise<void> {
  await writeJSON(featureRecordPath(slug, featureId), record);
}

async function loadAllFeatureRecords(
  slug: string
): Promise<FeatureProductivityRecord[]> {
  const dir = featureRecordsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const records: FeatureProductivityRecord[] = [];
  for (const file of files) {
    const featureId = file.replace(".json", "");
    const record = await loadFeatureRecord(slug, featureId);
    if (record) records.push(record);
  }
  return records;
}

// POST /hub/projects/:slug/productivity/features/:featureId — create record
productivity.post(
  "/hub/projects/:slug/productivity/features/:featureId",
  async (c) => {
    const slug = c.req.param("slug");
    const featureId = c.req.param("featureId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const existing = await loadFeatureRecord(slug, featureId);
    if (existing) {
      return c.json({ error: "Record already exists, use PATCH to update" }, 409);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = CreateFeatureProductivityBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const now = new Date().toISOString();
    const record: FeatureProductivityRecord = {
      feature_id: featureId,
      project_id: slug,
      origin: parsed.data.origin,
      started_at: parsed.data.started_at,
      completed_at: parsed.data.completed_at,
      total_duration_hours: parsed.data.total_duration_hours,
      review_rounds: parsed.data.review_rounds ?? 0,
      rework_count: parsed.data.rework_count ?? 0,
      defects_found: parsed.data.defects_found ?? 0,
      first_pass_accepted: parsed.data.first_pass_accepted ?? false,
      ai_tokens_used: parsed.data.ai_tokens_used ?? 0,
      ai_cost_usd: parsed.data.ai_cost_usd ?? 0,
      created_at: now,
      updated_at: now,
    };

    await saveFeatureRecord(slug, featureId, record);
    return c.json(record, 201);
  }
);

// PATCH /hub/projects/:slug/productivity/features/:featureId — update record
productivity.patch(
  "/hub/projects/:slug/productivity/features/:featureId",
  async (c) => {
    const slug = c.req.param("slug");
    const featureId = c.req.param("featureId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const existing = await loadFeatureRecord(slug, featureId);
    if (!existing) {
      return c.json({ error: "Record not found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchFeatureProductivityBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const updates = parsed.data;
    const updated: FeatureProductivityRecord = {
      ...existing,
      ...(updates.origin !== undefined && { origin: updates.origin }),
      ...(updates.started_at !== undefined && { started_at: updates.started_at }),
      ...(updates.completed_at !== undefined && { completed_at: updates.completed_at }),
      ...(updates.total_duration_hours !== undefined && {
        total_duration_hours: updates.total_duration_hours,
      }),
      ...(updates.review_rounds !== undefined && { review_rounds: updates.review_rounds }),
      ...(updates.rework_count !== undefined && { rework_count: updates.rework_count }),
      ...(updates.defects_found !== undefined && { defects_found: updates.defects_found }),
      ...(updates.first_pass_accepted !== undefined && {
        first_pass_accepted: updates.first_pass_accepted,
      }),
      ...(updates.ai_tokens_used !== undefined && { ai_tokens_used: updates.ai_tokens_used }),
      ...(updates.ai_cost_usd !== undefined && { ai_cost_usd: updates.ai_cost_usd }),
      updated_at: new Date().toISOString(),
    };

    await saveFeatureRecord(slug, featureId, updated);
    return c.json(updated);
  }
);

// GET /hub/projects/:slug/productivity/features — list all records with filters
productivity.get(
  "/hub/projects/:slug/productivity/features",
  async (c) => {
    const slug = c.req.param("slug");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const originFilter = c.req.query("origin");
    const firstPassFilter = c.req.query("first_pass");
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    let records = await loadAllFeatureRecords(slug);

    if (originFilter) {
      records = records.filter((r) => r.origin === originFilter);
    }

    if (firstPassFilter !== undefined && firstPassFilter !== null) {
      const firstPass = firstPassFilter === "true";
      records = records.filter((r) => r.first_pass_accepted === firstPass);
    }

    // Sort by created_at descending
    records.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    records = records.slice(0, limit);

    return c.json({ records });
  }
);

// GET /hub/projects/:slug/productivity/features/:featureId — get single record
productivity.get(
  "/hub/projects/:slug/productivity/features/:featureId",
  async (c) => {
    const slug = c.req.param("slug");
    const featureId = c.req.param("featureId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadFeatureRecord(slug, featureId);
    if (!record) {
      return c.json({ error: "Record not found" }, 404);
    }

    return c.json(record);
  }
);

export { productivity };

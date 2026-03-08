import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  FeatureVerificationRecordSchema,
  CreateVerificationRecordBodySchema,
  PatchVerificationRecordBodySchema,
  type FeatureVerificationRecord,
} from "../schemas/verification-record.js";
import { type Project } from "../schemas/project.js";

const verificationRecords = new Hono();

// ---- helpers ----

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function verificationDir(slug: string): string {
  return path.join(projectDir(slug), "verification", "records");
}

function recordPath(slug: string, featureId: string): string {
  return path.join(verificationDir(slug), `${featureId}.json`);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json"),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadRecord(
  slug: string,
  featureId: string,
): Promise<FeatureVerificationRecord | null> {
  try {
    return await readJSON<FeatureVerificationRecord>(
      recordPath(slug, featureId),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function listAllRecords(
  slug: string,
): Promise<FeatureVerificationRecord[]> {
  const dir = verificationDir(slug);
  try {
    const files = await readdir(dir);
    const records: FeatureVerificationRecord[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const rec = await readJSON<FeatureVerificationRecord>(
          path.join(dir, file),
        );
        records.push(rec);
      } catch {
        // skip corrupt files
      }
    }
    return records;
  } catch {
    return [];
  }
}

function computeCoverage(linesReviewed: number, linesGenerated: number): number {
  if (linesGenerated === 0) return 0;
  return Math.min(1, linesReviewed / linesGenerated);
}

// ---- GET /api/v1/hub/projects/:projectId/verification/records ----

verificationRecords.get(
  "/hub/projects/:projectId/verification/records",
  async (c) => {
    const projectId = c.req.param("projectId");
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const sprintFilter = c.req.query("sprint");
    const attributionFilter = c.req.query("attribution");
    const reworkedFilter = c.req.query("reworked");
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    let records = await listAllRecords(projectId);

    if (sprintFilter !== undefined) {
      const sprint = parseInt(sprintFilter, 10);
      records = records.filter((r) => r.sprint === sprint);
    }

    if (attributionFilter !== undefined) {
      records = records.filter((r) => r.attribution === attributionFilter);
    }

    if (reworkedFilter !== undefined) {
      const reworked = reworkedFilter === "true";
      records = records.filter((r) => r.reworked === reworked);
    }

    // Sort by created_at desc, then apply limit
    records.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    records = records.slice(0, limit);

    return c.json(records);
  },
);

// ---- POST /api/v1/hub/projects/:projectId/verification/records/:featureId ----

verificationRecords.post(
  "/hub/projects/:projectId/verification/records/:featureId",
  async (c) => {
    const projectId = c.req.param("projectId");
    const featureId = c.req.param("featureId");

    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = CreateVerificationRecordBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const record: FeatureVerificationRecord = {
      feature_id: featureId,
      project_id: data.project_id,
      sprint: data.sprint,
      attribution: data.attribution,
      lines_generated: data.lines_generated,
      lines_reviewed: data.lines_reviewed,
      review_coverage: computeCoverage(data.lines_reviewed, data.lines_generated),
      review_iterations: data.review_iterations,
      first_pass: data.first_pass,
      reworked: data.reworked,
      rework_reason: data.rework_reason,
      review_agents_used: data.review_agents_used,
      human_review_time_minutes: data.human_review_time_minutes,
      verified_at: data.verified_at,
      created_at: now,
    };

    await ensureDir(verificationDir(projectId));
    await writeJSON(recordPath(projectId, featureId), record);

    return c.json(record, 201);
  },
);

// ---- PATCH /api/v1/hub/projects/:projectId/verification/records/:featureId ----

verificationRecords.patch(
  "/hub/projects/:projectId/verification/records/:featureId",
  async (c) => {
    const projectId = c.req.param("projectId");
    const featureId = c.req.param("featureId");

    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const existing = await loadRecord(projectId, featureId);
    if (!existing) {
      return c.json({ error: "Verification record not found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchVerificationRecordBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
    }

    const patch = parsed.data;
    const updated: FeatureVerificationRecord = {
      ...existing,
      ...patch,
    };

    // Recompute review_coverage if lines changed
    const linesGenerated =
      patch.lines_generated !== undefined
        ? patch.lines_generated
        : existing.lines_generated;
    const linesReviewed =
      patch.lines_reviewed !== undefined
        ? patch.lines_reviewed
        : existing.lines_reviewed;
    updated.review_coverage = computeCoverage(linesReviewed, linesGenerated);

    await writeJSON(recordPath(projectId, featureId), updated);

    return c.json(updated);
  },
);

export { verificationRecords };

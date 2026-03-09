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
import { type AIProductivitySnapshot } from "../schemas/productivity-snapshot.js";
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

// --- Snapshot helpers ---

function snapshotsDir(slug: string): string {
  return path.join(projectDir(slug), "productivity", "snapshots");
}

function snapshotPath(slug: string, date: string): string {
  return path.join(snapshotsDir(slug), `${date}.json`);
}

async function loadSnapshot(
  slug: string,
  date: string
): Promise<AIProductivitySnapshot | null> {
  try {
    return await readJSON<AIProductivitySnapshot>(snapshotPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function isAiOrigin(origin: string): boolean {
  return origin === "ai_generated" || origin === "ai_assisted";
}

function isHumanOrigin(origin: string): boolean {
  return origin === "human_written";
}

function computeSnapshot(
  records: FeatureProductivityRecord[],
  slug: string,
  periodDays: number
): AIProductivitySnapshot {
  const now = new Date();
  const cutoff = new Date(now.getTime() - periodDays * 86400000);

  const periodRecords = records.filter((r) => {
    const date = r.completed_at || r.created_at;
    return new Date(date).getTime() >= cutoff.getTime();
  });

  const aiRecords = periodRecords.filter((r) => isAiOrigin(r.origin));
  const humanRecords = periodRecords.filter((r) => isHumanOrigin(r.origin));
  const mixedRecords = periodRecords.filter((r) => r.origin === "mixed");

  const totalFeatures = periodRecords.length;
  const aiFeatures = aiRecords.length + mixedRecords.length;
  const humanFeatures = humanRecords.length;

  // ai_rework_ratio: % of AI outputs that needed correction (rework_count > 0)
  const aiAll = [...aiRecords, ...mixedRecords];
  const aiReworkRatio =
    aiAll.length > 0
      ? aiAll.filter((r) => r.rework_count > 0).length / aiAll.length
      : 0;

  // human_rework_ratio: % of human outputs that needed correction
  const humanReworkRatio =
    humanRecords.length > 0
      ? humanRecords.filter((r) => r.rework_count > 0).length /
        humanRecords.length
      : 0;

  // first_pass_accuracy: % of AI features accepted without modification
  const firstPassAccuracy =
    aiAll.length > 0
      ? aiAll.filter((r) => r.first_pass_accepted).length / aiAll.length
      : 0;

  // defect_introduction_rate: features with defects / total features
  const defectRateAi =
    aiAll.length > 0
      ? aiAll.filter((r) => r.defects_found > 0).length / aiAll.length
      : 0;
  const defectRateHuman =
    humanRecords.length > 0
      ? humanRecords.filter((r) => r.defects_found > 0).length /
        humanRecords.length
      : 0;

  // Hours aggregation
  // Estimate: generation_time = total_duration - review_rounds * avg_review_time
  // Heuristic: review time per round ~ 0.5h, rework time ~ 1h per rework
  const AVG_REVIEW_HOURS_PER_ROUND = 0.5;
  const AVG_REWORK_HOURS = 1.0;
  // Heuristic: manual feature takes 2x the AI duration
  const MANUAL_MULTIPLIER = 2.0;

  let totalGenerationHours = 0;
  let totalReviewHours = 0;
  let totalReworkHours = 0;
  let totalTimeSavedHours = 0;
  let totalAiCostUsd = 0;

  for (const r of periodRecords) {
    const duration = r.total_duration_hours ?? 0;
    const reviewHours = r.review_rounds * AVG_REVIEW_HOURS_PER_ROUND;
    const reworkHours = r.rework_count * AVG_REWORK_HOURS;
    const generationHours = Math.max(0, duration - reviewHours - reworkHours);

    totalReviewHours += reviewHours;
    totalReworkHours += reworkHours;
    totalGenerationHours += generationHours;
    totalAiCostUsd += r.ai_cost_usd;

    if (isAiOrigin(r.origin) || r.origin === "mixed") {
      totalTimeSavedHours += duration * (MANUAL_MULTIPLIER - 1);
    }
  }

  // verification_tax_ratio: review_time / generation_time
  const verificationTaxRatio =
    totalGenerationHours > 0
      ? totalReviewHours / totalGenerationHours
      : 0;

  // net_roi_hours: time_saved - time_reviewing - rework_time
  const netRoiHours =
    totalTimeSavedHours - totalReviewHours - totalReworkHours;

  return {
    project_id: slug,
    period_days: periodDays,
    snapshot_date: now.toISOString(),
    total_features: totalFeatures,
    ai_features: aiFeatures,
    human_features: humanFeatures,
    ai_rework_ratio: round4(aiReworkRatio),
    human_rework_ratio: round4(humanReworkRatio),
    first_pass_accuracy: round4(firstPassAccuracy),
    defect_introduction_rate_ai: round4(defectRateAi),
    defect_introduction_rate_human: round4(defectRateHuman),
    verification_tax_ratio: round4(verificationTaxRatio),
    net_roi_hours: round4(netRoiHours),
    total_ai_cost_usd: round4(totalAiCostUsd),
    total_generation_hours: round4(totalGenerationHours),
    total_review_hours: round4(totalReviewHours),
    total_rework_hours: round4(totalReworkHours),
    total_time_saved_hours: round4(totalTimeSavedHours),
    created_at: now.toISOString(),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getWeekStart(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const ws = new Date(d);
  ws.setDate(diff);
  ws.setHours(0, 0, 0, 0);
  return ws;
}

// GET /hub/projects/:slug/productivity/snapshot?period_days=30
productivity.get(
  "/hub/projects/:slug/productivity/snapshot",
  async (c) => {
    const slug = c.req.param("slug");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const periodDays = parseInt(c.req.query("period_days") || "30", 10);
    const records = await loadAllFeatureRecords(slug);
    const snapshot = computeSnapshot(records, slug, periodDays);

    // Persist snapshot
    const dateStr = toDateStr(new Date());
    await writeJSON(snapshotPath(slug, dateStr), snapshot);

    return c.json(snapshot);
  }
);

// GET /hub/projects/:slug/productivity/history?from&to&granularity=weekly
productivity.get(
  "/hub/projects/:slug/productivity/history",
  async (c) => {
    const slug = c.req.param("slug");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const fromParam = c.req.query("from");
    const toParam = c.req.query("to");
    const now = new Date();
    const from = fromParam ? new Date(fromParam) : new Date(now.getTime() - 90 * 86400000);
    const to = toParam ? new Date(toParam) : now;

    const records = await loadAllFeatureRecords(slug);

    // Generate weekly snapshots
    const weeks: Array<{ week_start: string; snapshot: AIProductivitySnapshot }> = [];
    const weekStart = getWeekStart(from);
    const endDate = to;

    const current = new Date(weekStart);
    while (current.getTime() <= endDate.getTime()) {
      const weekEnd = new Date(current.getTime() + 7 * 86400000);
      const periodStart = current;

      // Filter records within this week
      const weekRecords = records.filter((r) => {
        const date = new Date(r.completed_at || r.created_at);
        return (
          date.getTime() >= periodStart.getTime() &&
          date.getTime() < weekEnd.getTime()
        );
      });

      if (weekRecords.length > 0) {
        const snapshot = computeSnapshot(weekRecords, slug, 7);
        // Override snapshot_date to the week start for consistency
        snapshot.snapshot_date = current.toISOString();
        snapshot.period_days = 7;
        weeks.push({
          week_start: toDateStr(current),
          snapshot,
        });
      }

      current.setTime(current.getTime() + 7 * 86400000);
    }

    return c.json({ history: weeks, from: toDateStr(from), to: toDateStr(to), granularity: "weekly" });
  }
);

export { productivity };

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateContributionQualityResultBody,
  type ContributionQualityResult,
} from "../schemas/contribution-quality-results.js";
import { type Project } from "../schemas/project.js";

const contributionQualityResults = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function resultsDir(slug: string): string {
  return path.join(projectDir(slug), "contribution-quality-results");
}

function dayPath(slug: string, date: string): string {
  return path.join(resultsDir(slug), `${date}.json`);
}

// --- Project loading ---

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(path.join(projectDir(slug), "project.json"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

// --- Day file helpers ---

async function loadDayRecords(
  slug: string,
  date: string
): Promise<ContributionQualityResult[]> {
  try {
    return await readJSON<ContributionQualityResult[]>(dayPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayRecords(
  slug: string,
  date: string,
  records: ContributionQualityResult[]
): Promise<void> {
  await ensureDir(resultsDir(slug));
  await writeJSON(dayPath(slug, date), records);
}

async function loadAllRecords(
  slug: string
): Promise<ContributionQualityResult[]> {
  const dir = resultsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: ContributionQualityResult[] = [];
  for (const file of files) {
    try {
      const dayRecords = await readJSON<ContributionQualityResult[]>(
        path.join(dir, file)
      );
      if (Array.isArray(dayRecords)) all.push(...dayRecords);
    } catch {
      // skip malformed files
    }
  }
  return all;
}

// --- Routes ---

// POST /hub/projects/:projectId/contribution-quality-results — create record (called by engine)
contributionQualityResults.post(
  "/hub/projects/:projectId/contribution-quality-results",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = CreateContributionQualityResultBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const data = parsed.data;
    const now = new Date();
    const record: ContributionQualityResult = {
      id: randomUUID(),
      project_id: slug,
      feature_id: data.feature_id ?? null,
      context: data.context,
      scores: data.scores,
      overall_score: data.overall_score,
      passed: data.passed,
      auto_rejected: data.auto_rejected,
      flags: data.flags,
      evaluated_at: data.evaluated_at ?? now.toISOString(),
      evaluator_agent: data.evaluator_agent,
    };

    const dateKey = now.toISOString().slice(0, 10);
    const dayRecords = await loadDayRecords(slug, dateKey);
    dayRecords.push(record);
    await saveDayRecords(slug, dateKey, dayRecords);

    return c.json(record, 201);
  }
);

// GET /hub/projects/:projectId/contribution-quality-results — list with filters
contributionQualityResults.get(
  "/hub/projects/:projectId/contribution-quality-results",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const featureIdFilter = c.req.query("feature_id");
    const contextFilter = c.req.query("context");
    const passedFilter = c.req.query("passed");
    const autoRejectedFilter = c.req.query("auto_rejected");
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    let records = await loadAllRecords(slug);

    if (featureIdFilter) {
      records = records.filter((r) => r.feature_id === featureIdFilter);
    }
    if (contextFilter) {
      records = records.filter((r) => r.context === contextFilter);
    }
    if (passedFilter !== undefined && passedFilter !== null) {
      const passedBool = passedFilter === "true";
      records = records.filter((r) => r.passed === passedBool);
    }
    if (autoRejectedFilter !== undefined && autoRejectedFilter !== null) {
      const autoRejectedBool = autoRejectedFilter === "true";
      records = records.filter((r) => r.auto_rejected === autoRejectedBool);
    }

    records.sort(
      (a, b) =>
        new Date(b.evaluated_at).getTime() -
        new Date(a.evaluated_at).getTime()
    );

    if (limit > 0) {
      records = records.slice(0, limit);
    }

    return c.json(records);
  }
);

export { contributionQualityResults };

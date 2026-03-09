import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  TestCoverageResultSchema,
  CreateTestCoverageResultBody,
  type TestCoverageResult,
} from "../schemas/test-coverage-results.js";
import { type Project } from "../schemas/project.js";

const testCoverageResults = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function resultsDir(slug: string): string {
  return path.join(projectDir(slug), "test-coverage-results");
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
): Promise<TestCoverageResult[]> {
  try {
    return await readJSON<TestCoverageResult[]>(dayPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayRecords(
  slug: string,
  date: string,
  records: TestCoverageResult[]
): Promise<void> {
  await ensureDir(resultsDir(slug));
  await writeJSON(dayPath(slug, date), records);
}

async function loadAllRecords(slug: string): Promise<TestCoverageResult[]> {
  const dir = resultsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: TestCoverageResult[] = [];
  for (const file of files) {
    try {
      const dayRecords = await readJSON<TestCoverageResult[]>(
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

// POST /hub/projects/:projectId/test-coverage-results — create record (called by engine)
testCoverageResults.post(
  "/hub/projects/:projectId/test-coverage-results",
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

    const parsed = CreateTestCoverageResultBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const data = parsed.data;
    const now = new Date();
    const record: TestCoverageResult = {
      id: randomUUID(),
      project_id: slug,
      feature_id: data.feature_id,
      attempt: data.attempt,
      lines_pct: data.lines_pct,
      branches_pct: data.branches_pct,
      functions_pct: data.functions_pct,
      statements_pct: data.statements_pct,
      overall_pct: data.overall_pct,
      threshold_pct: data.threshold_pct,
      passed: data.passed,
      uncovered_files: data.uncovered_files,
      tool_used: data.tool_used,
      stdout_preview: data.stdout_preview ?? null,
      executed_at: now.toISOString(),
      duration_ms: data.duration_ms,
    };

    const dateKey = now.toISOString().slice(0, 10);
    const dayRecords = await loadDayRecords(slug, dateKey);
    dayRecords.push(record);
    await saveDayRecords(slug, dateKey, dayRecords);

    return c.json(record, 201);
  }
);

// GET /hub/projects/:projectId/test-coverage-results — list with filters
testCoverageResults.get(
  "/hub/projects/:projectId/test-coverage-results",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const featureIdFilter = c.req.query("feature_id");
    const passedFilter = c.req.query("passed");
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    let records = await loadAllRecords(slug);

    if (featureIdFilter) {
      records = records.filter((r) => r.feature_id === featureIdFilter);
    }
    if (passedFilter !== undefined && passedFilter !== null) {
      const passedBool = passedFilter === "true";
      records = records.filter((r) => r.passed === passedBool);
    }

    records.sort(
      (a, b) =>
        new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime()
    );

    if (limit > 0) {
      records = records.slice(0, limit);
    }

    return c.json(records);
  }
);

// GET /hub/projects/:projectId/sprints/:sprint/features/:featureId/quality
// Returns { coverage: TestCoverageResult | null, quality: ContributionQualityResult | null }
testCoverageResults.get(
  "/hub/projects/:projectId/sprints/:sprint/features/:featureId/quality",
  async (c) => {
    const slug = c.req.param("projectId");
    const featureId = c.req.param("featureId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    // Find most recent coverage result for this feature
    const allCoverage = await loadAllRecords(slug);
    const featureCoverage = allCoverage
      .filter((r) => r.feature_id === featureId)
      .sort(
        (a, b) =>
          new Date(b.executed_at).getTime() -
          new Date(a.executed_at).getTime()
      );
    const latestCoverage = featureCoverage[0] ?? null;

    // Find most recent contribution quality result for this feature
    let latestQuality: unknown = null;
    try {
      const qualityDir = path.join(
        projectDir(slug),
        "contribution-quality-results"
      );
      const files = (await readdir(qualityDir))
        .filter((f) => f.endsWith(".json"))
        .sort();
      for (let i = files.length - 1; i >= 0; i--) {
        const dayRecords = await readJSON<Array<{ feature_id?: string }>>(
          path.join(qualityDir, files[i]!)
        );
        if (Array.isArray(dayRecords)) {
          const match = dayRecords
            .filter((r) => r.feature_id === featureId)
            .pop();
          if (match) {
            latestQuality = match;
            break;
          }
        }
      }
    } catch {
      // no quality results yet
    }

    return c.json({
      coverage: latestCoverage,
      quality: latestQuality,
    });
  }
);

export { testCoverageResults };

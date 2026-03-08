import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  FeatureCycleRecordSchema,
  CreateFeatureCycleBody,
  PatchFeatureCycleBody,
  type FeatureCycleRecord,
} from "../schemas/feature-cycle.js";
import { type Project } from "../schemas/project.js";

const featureCycles = new Hono();

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

function cyclesDirPath(slug: string): string {
  return path.join(projectDir(slug), "feature-cycles");
}

function cyclePath(slug: string, featureId: string): string {
  return path.join(cyclesDirPath(slug), `${featureId}.json`);
}

async function loadAllCycles(slug: string): Promise<FeatureCycleRecord[]> {
  const dir = cyclesDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }
  const cycles = await Promise.all(
    files.map((f) => readJSON<FeatureCycleRecord>(path.join(dir, f)))
  );
  return cycles;
}

function computeFirstPass(attempts: number, reviewIterations: number): boolean {
  return attempts === 1 && reviewIterations <= 1;
}

function computeCycleTimeHours(
  startedAt: string,
  completedAt: string | null
): number | null {
  if (!completedAt) return null;
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (isNaN(start) || isNaN(end)) return null;
  return Math.round(((end - start) / (1000 * 60 * 60)) * 100) / 100;
}

// GET /hub/projects/:projectId/throughput/feature-cycles
featureCycles.get(
  "/hub/projects/:projectId/throughput/feature-cycles",
  async (c) => {
    const { projectId } = c.req.param();
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const sprint = c.req.query("sprint");
    const status = c.req.query("status");
    const aiContribution = c.req.query("ai_contribution");
    const limit = parseInt(c.req.query("limit") ?? "100", 10);

    let cycles = await loadAllCycles(projectId);

    if (sprint !== undefined) {
      const sprintNum = parseInt(sprint, 10);
      cycles = cycles.filter((cy) => cy.sprint === sprintNum);
    }
    if (status) {
      cycles = cycles.filter((cy) => cy.status === status);
    }
    if (aiContribution) {
      cycles = cycles.filter((cy) => cy.ai_contribution === aiContribution);
    }

    cycles = cycles.slice(0, limit);

    return c.json({ cycles, total: cycles.length });
  }
);

// POST /hub/projects/:projectId/throughput/feature-cycles
featureCycles.post(
  "/hub/projects/:projectId/throughput/feature-cycles",
  async (c) => {
    const { projectId } = c.req.param();
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

    const parsed = CreateFeatureCycleBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
    }

    const data = parsed.data;
    const now = new Date().toISOString();
    const attempts = data.attempts ?? 1;
    const reviewIterations = data.review_iterations ?? 0;

    const record: FeatureCycleRecord = {
      id: randomUUID(),
      project_id: project.id,
      feature_id: data.feature_id,
      sprint: data.sprint,
      started_at: data.started_at ?? now,
      completed_at: null,
      status: data.status ?? "in_progress",
      attempts,
      review_iterations: reviewIterations,
      first_pass: computeFirstPass(attempts, reviewIterations),
      ai_contribution: data.ai_contribution,
      cycle_time_hours: null,
      tags: data.tags ?? [],
    };

    await ensureDir(cyclesDirPath(projectId));
    await writeJSON(cyclePath(projectId, record.feature_id), record);

    return c.json({ cycle: record }, 201);
  }
);

// PATCH /hub/projects/:projectId/throughput/feature-cycles/:cycleId
featureCycles.patch(
  "/hub/projects/:projectId/throughput/feature-cycles/:cycleId",
  async (c) => {
    const { projectId, cycleId } = c.req.param();
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    // Find cycle by id across all files
    const allCycles = await loadAllCycles(projectId);
    const existing = allCycles.find((cy) => cy.id === cycleId);
    if (!existing) {
      return c.json({ error: "Cycle not found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchFeatureCycleBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
    }

    const patch = parsed.data;
    const updated: FeatureCycleRecord = { ...existing, ...patch };

    // Auto-calculate cycle_time_hours when completing
    const isTerminal =
      updated.status === "completed" ||
      updated.status === "failed" ||
      updated.status === "skipped";

    if (isTerminal && !updated.completed_at) {
      updated.completed_at = new Date().toISOString();
    }

    if (updated.completed_at) {
      updated.cycle_time_hours = computeCycleTimeHours(
        updated.started_at,
        updated.completed_at
      );
    }

    // Auto-calculate first_pass
    updated.first_pass = computeFirstPass(
      updated.attempts,
      updated.review_iterations
    );

    await writeJSON(cyclePath(projectId, existing.feature_id), updated);

    return c.json({ cycle: updated });
  }
);

export { featureCycles };

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  PhaseModelConfigSchema,
  PatchPhaseModelConfigBody,
  CreateModelOutputAttributionBody,
  MODEL_CATALOG,
  type PhaseModelConfig,
  type ModelOutputAttribution,
} from "../schemas/phase-model-config.js";
import { type Project } from "../schemas/project.js";

const modelRouting = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function phaseModelConfigsDir(slug: string): string {
  return path.join(projectDir(slug), "phase-model-configs");
}

function phaseModelConfigPath(slug: string, workflow: string): string {
  return path.join(phaseModelConfigsDir(slug), `${workflow}.json`);
}

function modelAttributionsDir(slug: string): string {
  return path.join(projectDir(slug), "model-attributions");
}

function modelAttributionDayPath(slug: string, date: string): string {
  return path.join(modelAttributionsDir(slug), `${date}.json`);
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

// --- Day file helpers for attributions ---

async function loadDayAttributions(
  slug: string,
  date: string
): Promise<ModelOutputAttribution[]> {
  try {
    return await readJSON<ModelOutputAttribution[]>(modelAttributionDayPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayAttributions(
  slug: string,
  date: string,
  records: ModelOutputAttribution[]
): Promise<void> {
  await ensureDir(modelAttributionsDir(slug));
  await writeJSON(modelAttributionDayPath(slug, date), records);
}

async function loadAllAttributions(slug: string): Promise<ModelOutputAttribution[]> {
  const dir = modelAttributionsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: ModelOutputAttribution[] = [];
  for (const file of files) {
    try {
      const dayRecords = await readJSON<ModelOutputAttribution[]>(path.join(dir, file));
      if (Array.isArray(dayRecords)) all.push(...dayRecords);
    } catch {
      // skip malformed files
    }
  }
  return all;
}

// --- PhaseModelConfig routes ---

// GET /hub/projects/:slug/phase-model-configs/:workflow
modelRouting.get("/hub/projects/:slug/phase-model-configs/:workflow", async (c) => {
  const slug = c.req.param("slug");
  const workflow = c.req.param("workflow");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  try {
    const configData = await readJSON<PhaseModelConfig>(phaseModelConfigPath(slug, workflow));
    return c.json(configData);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      // Return default empty config
      const defaultConfig: PhaseModelConfig = {
        project_id: slug,
        workflow,
        step_overrides: {},
        updated_at: new Date().toISOString(),
      };
      return c.json(defaultConfig);
    }
    throw err;
  }
});

// PATCH /hub/projects/:slug/phase-model-configs/:workflow
modelRouting.patch("/hub/projects/:slug/phase-model-configs/:workflow", async (c) => {
  const slug = c.req.param("slug");
  const workflow = c.req.param("workflow");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchPhaseModelConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  // Load existing or create default
  let existing: PhaseModelConfig;
  try {
    existing = await readJSON<PhaseModelConfig>(phaseModelConfigPath(slug, workflow));
  } catch {
    existing = {
      project_id: slug,
      workflow,
      step_overrides: {},
      updated_at: new Date().toISOString(),
    };
  }

  // Apply patch
  if (parsed.data.step_overrides !== undefined) {
    existing.step_overrides = parsed.data.step_overrides;
  }
  existing.updated_at = new Date().toISOString();

  // Persist
  await ensureDir(phaseModelConfigsDir(slug));
  await writeJSON(phaseModelConfigPath(slug, workflow), existing);

  return c.json(existing);
});

// --- ModelOutputAttribution routes ---

// POST /hub/projects/:slug/model-attributions
modelRouting.post("/hub/projects/:slug/model-attributions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateModelOutputAttributionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const now = new Date();
  const record: ModelOutputAttribution = {
    id: randomUUID(),
    project_id: slug,
    artifact_id: data.artifact_id ?? null,
    feature_id: data.feature_id ?? null,
    phase: data.phase,
    step_name: data.step_name,
    model_used: data.model_used,
    spawn_dir: data.spawn_dir ?? null,
    recorded_at: now.toISOString(),
  };

  const dateKey = now.toISOString().slice(0, 10);
  const dayRecords = await loadDayAttributions(slug, dateKey);
  dayRecords.push(record);
  await saveDayAttributions(slug, dateKey, dayRecords);

  return c.json(record, 201);
});

// GET /hub/projects/:slug/model-attributions
modelRouting.get("/hub/projects/:slug/model-attributions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const fromFilter = c.req.query("from");
  const phaseFilter = c.req.query("phase");
  const featureIdFilter = c.req.query("feature_id");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  let records = await loadAllAttributions(slug);

  if (fromFilter) {
    records = records.filter((r) => r.recorded_at >= fromFilter);
  }
  if (phaseFilter) {
    records = records.filter((r) => r.phase === phaseFilter);
  }
  if (featureIdFilter) {
    records = records.filter((r) => r.feature_id === featureIdFilter);
  }

  records.sort(
    (a, b) =>
      new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime()
  );

  if (limit > 0) {
    records = records.slice(0, limit);
  }

  return c.json(records);
});

// --- Model Catalog ---

// GET /hub/model-catalog
modelRouting.get("/hub/model-catalog", async (c) => {
  return c.json({ models: MODEL_CATALOG });
});

export { modelRouting };

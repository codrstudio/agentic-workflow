import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  LearningModeConfigSchema,
  MODE_DEFAULTS,
  PutLearningModeBody,
  ReflectionCheckpointSchema,
  CreateReflectionBody,
  PatchReflectionBody,
  type LearningModeConfig,
  type ReflectionCheckpoint,
} from "../schemas/learning-mode.js";
import { type Project } from "../schemas/project.js";

const learningMode = new Hono();

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

function learningModeConfigPath(slug: string): string {
  return path.join(projectDir(slug), "learning-mode-config.json");
}

function reflectionsDirPath(slug: string): string {
  return path.join(projectDir(slug), "reflections");
}

function reflectionPath(slug: string, id: string): string {
  return path.join(reflectionsDirPath(slug), `${id}.json`);
}

async function loadLearningModeConfig(
  slug: string,
  projectId: string
): Promise<LearningModeConfig> {
  try {
    return await readJSON<LearningModeConfig>(learningModeConfigPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      // Return default config
      return {
        project_id: projectId,
        mode: "standard",
        phase_transitions: MODE_DEFAULTS.standard,
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

// GET /hub/projects/:slug/learning-mode
learningMode.get("/hub/projects/:slug/learning-mode", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const cfg = await loadLearningModeConfig(slug, project.id);
  return c.json(cfg);
});

// PUT /hub/projects/:slug/learning-mode
learningMode.put("/hub/projects/:slug/learning-mode", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PutLearningModeBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const { mode, phase_transitions } = parsed.data;

  // If phase_transitions not provided, use mode defaults
  const transitions = phase_transitions ?? MODE_DEFAULTS[mode];

  const cfg: LearningModeConfig = {
    project_id: project.id,
    mode,
    phase_transitions: transitions,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(learningModeConfigPath(slug), cfg);
  return c.json(cfg);
});

// GET /hub/projects/:slug/reflections
learningMode.get("/hub/projects/:slug/reflections", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const dir = reflectionsDirPath(slug);

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

  const reflections: ReflectionCheckpoint[] = [];
  for (const file of files) {
    try {
      const r = await readJSON<ReflectionCheckpoint>(path.join(dir, file));
      reflections.push(r);
    } catch {
      // skip malformed files
    }
  }

  // Apply query filters
  const phaseTransition = c.req.query("phase_transition");
  const depth = c.req.query("depth");
  const skipped = c.req.query("skipped");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);

  let filtered = reflections;

  if (phaseTransition) {
    filtered = filtered.filter((r) => r.phase_transition === phaseTransition);
  }

  if (depth) {
    filtered = filtered.filter((r) => r.depth_classification === depth);
  }

  if (skipped !== undefined) {
    const skippedBool = skipped === "true";
    filtered = filtered.filter((r) => r.skipped === skippedBool);
  }

  filtered = filtered.slice(0, isNaN(limit) ? 50 : limit);

  return c.json(filtered);
});

// POST /hub/projects/:slug/reflections
learningMode.post("/hub/projects/:slug/reflections", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateReflectionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  const reflection: ReflectionCheckpoint = {
    id,
    project_id: project.id,
    phase_transition: parsed.data.phase_transition,
    checkpoint_type: parsed.data.checkpoint_type,
    questions: parsed.data.questions,
    developer_response: parsed.data.developer_response ?? null,
    ai_evaluation: parsed.data.ai_evaluation ?? null,
    depth_classification: parsed.data.depth_classification ?? null,
    skipped: parsed.data.skipped ?? false,
    created_at: now,
    completed_at: parsed.data.completed_at ?? null,
  };

  await ensureDir(reflectionsDirPath(slug));
  await writeJSON(reflectionPath(slug, id), reflection);

  return c.json(reflection, 201);
});

// PATCH /hub/projects/:slug/reflections/:reflectionId
learningMode.patch(
  "/hub/projects/:slug/reflections/:reflectionId",
  async (c) => {
    const slug = c.req.param("slug");
    const reflectionId = c.req.param("reflectionId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let existing: ReflectionCheckpoint;
    try {
      existing = await readJSON<ReflectionCheckpoint>(
        reflectionPath(slug, reflectionId)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        return c.json({ error: "Reflection not found" }, 404);
      }
      throw err;
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchReflectionBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid body", details: parsed.error.issues },
        400
      );
    }

    const updated: ReflectionCheckpoint = {
      ...existing,
      ...Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v !== undefined)
      ),
    };

    await writeJSON(reflectionPath(slug, reflectionId), updated);
    return c.json(updated);
  }
);

export { learningMode };

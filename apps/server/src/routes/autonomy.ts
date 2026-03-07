import { Hono } from "hono";
import path from "node:path";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  PatchPhaseAutonomyBody,
  PHASE_DEFAULTS,
  ALL_PHASES,
  type PhaseAutonomyConfig,
  type PipelinePhase,
} from "../schemas/phase-autonomy.js";
import { type Project } from "../schemas/project.js";

const autonomy = new Hono();

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

function phaseConfigPath(slug: string, phase: string): string {
  return path.join(
    projectDir(slug),
    "autonomy",
    "phase-configs",
    `${phase}.json`
  );
}

async function loadPhaseConfig(
  slug: string,
  phase: PipelinePhase
): Promise<PhaseAutonomyConfig> {
  try {
    return await readJSON<PhaseAutonomyConfig>(phaseConfigPath(slug, phase));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      const defaults = PHASE_DEFAULTS[phase];
      return { ...defaults, updated_at: new Date().toISOString() };
    }
    throw err;
  }
}

async function savePhaseConfig(
  slug: string,
  config: PhaseAutonomyConfig
): Promise<void> {
  await writeJSON(phaseConfigPath(slug, config.phase), config);
}

// GET /hub/projects/:slug/autonomy/phases — get all 6 phase configs
autonomy.get("/hub/projects/:slug/autonomy/phases", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const phases = await Promise.all(
    ALL_PHASES.map((phase) => loadPhaseConfig(slug, phase))
  );

  return c.json({ phases });
});

// PATCH /hub/projects/:slug/autonomy/phases — update a single phase config
autonomy.patch("/hub/projects/:slug/autonomy/phases", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchPhaseAutonomyBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { phase, ...updates } = parsed.data;
  const current = await loadPhaseConfig(slug, phase);
  const updated: PhaseAutonomyConfig = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await savePhaseConfig(slug, updated);

  return c.json(updated);
});

export { autonomy };

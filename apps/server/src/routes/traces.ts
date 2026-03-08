import { Hono } from "hono";
import path from "node:path";
import { stat } from "node:fs/promises";
import { readJSON, listDirs } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { buildTrace, loadOrBuildTrace } from "../lib/trace-builder.js";
import type { Project } from "../schemas/project.js";
import type { PipelineTrace } from "../schemas/pipeline-trace.js";

const traces = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function workspaceDir(slug: string): string {
  return path.join(config.workspacesDir, slug);
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

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function listWaveNumbers(wsDir: string): Promise<number[]> {
  const dirs = await listDirs(wsDir);
  return dirs
    .map((d) => {
      const m = d.match(/^wave-(\d+)$/);
      return m ? parseInt(m[1]!, 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
}

// POST /hub/projects/:slug/traces/build — build (or rebuild) trace for a specific wave
traces.post("/hub/projects/:slug/traces/build", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<{ wave: number }>().catch(() => ({ wave: 0 }));

  const waveNumber = typeof body.wave === "number" ? body.wave : parseInt(String(body.wave), 10);
  if (!waveNumber || isNaN(waveNumber) || waveNumber < 1) {
    return c.json({ error: "wave must be a positive integer" }, 400);
  }

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const wsDir = workspaceDir(slug);
  if (!(await dirExists(wsDir))) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const waveDir = path.join(wsDir, `wave-${waveNumber}`);
  if (!(await dirExists(waveDir))) {
    return c.json({ error: `Wave ${waveNumber} not found` }, 404);
  }

  const trace = await buildTrace(
    wsDir,
    waveNumber,
    project.id,
    slug,
    projectDir(slug)
  );

  return c.json(trace, 201);
});

// GET /hub/projects/:slug/traces — list available traces (summary, no spans)
traces.get("/hub/projects/:slug/traces", async (c) => {
  const slug = c.req.param("slug");
  const waveParam = c.req.query("wave");

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const wsDir = workspaceDir(slug);
  if (!(await dirExists(wsDir))) {
    return c.json({ traces: [] });
  }

  const waveNumbers = waveParam
    ? [parseInt(waveParam, 10)].filter((n) => !isNaN(n) && n > 0)
    : await listWaveNumbers(wsDir);

  const result: Array<Omit<PipelineTrace, "spans"> & { span_count: number }> = [];

  for (const waveNum of waveNumbers) {
    const waveDir = path.join(wsDir, `wave-${waveNum}`);
    if (!(await dirExists(waveDir))) continue;

    const trace = await loadOrBuildTrace(
      wsDir,
      waveNum,
      project.id,
      slug,
      projectDir(slug)
    );

    const { spans, ...summary } = trace;
    result.push({ ...summary, span_count: spans.length });
  }

  return c.json({ traces: result });
});

// GET /hub/projects/:slug/traces/wave/:wave — get full trace with spans
traces.get("/hub/projects/:slug/traces/wave/:wave", async (c) => {
  const slug = c.req.param("slug");
  const waveNumber = parseInt(c.req.param("wave"), 10);

  if (isNaN(waveNumber) || waveNumber < 1) {
    return c.json({ error: "Invalid wave number" }, 400);
  }

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const wsDir = workspaceDir(slug);
  if (!(await dirExists(wsDir))) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const waveDir = path.join(wsDir, `wave-${waveNumber}`);
  if (!(await dirExists(waveDir))) {
    return c.json({ error: `Wave ${waveNumber} not found` }, 404);
  }

  const trace = await loadOrBuildTrace(
    wsDir,
    waveNumber,
    project.id,
    slug,
    projectDir(slug)
  );

  return c.json(trace);
});

export { traces };

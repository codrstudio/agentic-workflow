import { Hono } from "hono";
import path from "node:path";
import { stat } from "node:fs/promises";
import { readJSON, listDirs } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { buildTrace, loadOrBuildTrace } from "../lib/trace-builder.js";
import type { Project } from "../schemas/project.js";
import type { PipelineTrace, TraceSpan } from "../schemas/pipeline-trace.js";

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
// Filters: wave, status, feature_id, min_duration_ms, has_error, from, to
traces.get("/hub/projects/:slug/traces", async (c) => {
  const slug = c.req.param("slug");
  const waveParam = c.req.query("wave");
  const statusFilter = c.req.query("status");
  const featureIdFilter = c.req.query("feature_id");
  const minDurationParam = c.req.query("min_duration_ms");
  const hasErrorParam = c.req.query("has_error");
  const fromParam = c.req.query("from");
  const toParam = c.req.query("to");

  const minDuration = minDurationParam ? parseInt(minDurationParam, 10) : null;
  const hasError = hasErrorParam === "true" ? true : hasErrorParam === "false" ? false : null;
  const fromDate = fromParam ? new Date(fromParam) : null;
  const toDate = toParam ? new Date(toParam) : null;

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

    // Apply filters
    if (statusFilter && trace.status !== statusFilter) continue;

    if (featureIdFilter) {
      const hasFeature = trace.spans.some(
        (s) => s.metadata["feature_id"] === featureIdFilter
      );
      if (!hasFeature) continue;
    }

    if (minDuration !== null && minDuration > 0) {
      const waveDuration = trace.spans.find((s) => s.type === "wave")?.duration_ms ?? null;
      if (waveDuration === null || waveDuration < minDuration) continue;
    }

    if (hasError !== null) {
      const traceHasError = trace.spans.some((s) => s.error !== null);
      if (traceHasError !== hasError) continue;
    }

    if (fromDate && !isNaN(fromDate.getTime())) {
      if (new Date(trace.started_at) < fromDate) continue;
    }

    if (toDate && !isNaN(toDate.getTime())) {
      if (new Date(trace.started_at) > toDate) continue;
    }

    const { spans, ...summary } = trace;
    result.push({ ...summary, span_count: spans.length });
  }

  return c.json({ traces: result });
});

async function findTraceById(
  wsDir: string,
  slug: string,
  projectId: string,
  pDir: string,
  traceId: string
): Promise<PipelineTrace | null> {
  const waveNumbers = await listWaveNumbers(wsDir);
  for (const waveNum of waveNumbers) {
    const waveDir = path.join(wsDir, `wave-${waveNum}`);
    if (!(await dirExists(waveDir))) continue;
    const trace = await loadOrBuildTrace(wsDir, waveNum, projectId, slug, pDir);
    if (trace.trace_id === traceId) return trace;
  }
  return null;
}

// GET /hub/projects/:slug/traces/:traceId — get full trace with spans by trace ID
traces.get("/hub/projects/:slug/traces/:traceId/spans/:spanId", async (c) => {
  const slug = c.req.param("slug");
  const traceId = c.req.param("traceId");
  const spanId = c.req.param("spanId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const wsDir = workspaceDir(slug);
  if (!(await dirExists(wsDir))) return c.json({ error: "Workspace not found" }, 404);

  const trace = await findTraceById(wsDir, slug, project.id, projectDir(slug), traceId);
  if (!trace) return c.json({ error: "Trace not found" }, 404);

  const span: TraceSpan | undefined = trace.spans.find((s) => s.id === spanId);
  if (!span) return c.json({ error: "Span not found" }, 404);

  return c.json(span);
});

traces.get("/hub/projects/:slug/traces/:traceId", async (c) => {
  const slug = c.req.param("slug");
  const traceId = c.req.param("traceId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const wsDir = workspaceDir(slug);
  if (!(await dirExists(wsDir))) return c.json({ error: "Workspace not found" }, 404);

  const trace = await findTraceById(wsDir, slug, project.id, projectDir(slug), traceId);
  if (!trace) return c.json({ error: "Trace not found" }, 404);

  return c.json(trace);
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

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { EventEmitter } from "node:events";
import path from "node:path";
import { stat, readFile } from "node:fs/promises";
import { readJSON, listDirs } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { buildTrace, loadOrBuildTrace } from "../lib/trace-builder.js";
import type { Project } from "../schemas/project.js";
import type { PipelineTrace, TraceSpan } from "../schemas/pipeline-trace.js";

// In-memory event bus for live trace SSE events
export const traceEventBus = new EventEmitter();
traceEventBus.setMaxListeners(200);

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

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
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

/**
 * Resolve the spawn.jsonl path for a given span.
 * Returns null if the span type has no associated jsonl file.
 */
async function resolveSpanJsonlPath(
  wsDir: string,
  waveNum: number,
  traceId: string,
  spanId: string
): Promise<string | null> {
  const waveDir = path.join(wsDir, `wave-${waveNum}`);

  // Strip the traceId prefix to get the suffix
  const prefix = traceId + "-";
  if (!spanId.startsWith(prefix)) return null;
  const suffix = spanId.slice(prefix.length);

  // merge / merge-agent-call
  if (suffix === "merge" || suffix === "merge-agent-call") {
    const p = path.join(waveDir, "merge", "spawn.jsonl");
    return (await fileExists(p)) ? p : null;
  }

  // F-{nnn}-attempt-{M} or F-{nnn}-attempt-{M}-agent-call
  const featureMatch = suffix.match(/^(F-\d+)-attempt-(\d+)(?:-agent-call)?$/);
  if (featureMatch) {
    const featureId = featureMatch[1]!;
    const attempt = featureMatch[2]!;
    const dirs = await listDirs(waveDir);
    const loopDir = dirs.find((d) => d.endsWith("-ralph-wiggum-loop"));
    if (!loopDir) return null;
    const p = path.join(waveDir, loopDir, `${featureId}-attempt-${attempt}`, "spawn.jsonl");
    return (await fileExists(p)) ? p : null;
  }

  // step-{N}-{name}-agent-call (try agent-call suffix first to avoid ambiguity)
  const stepAgentCallMatch = suffix.match(/^step-(\d+)-(.+)-agent-call$/);
  if (stepAgentCallMatch) {
    const stepNum = parseInt(stepAgentCallMatch[1]!, 10);
    const stepName = stepAgentCallMatch[2]!;
    const dirs = await listDirs(waveDir);
    const stepDir = dirs.find((d) => {
      const m = d.match(/^step-(\d+)-(.+)$/);
      return m && parseInt(m[1]!, 10) === stepNum && m[2] === stepName;
    });
    if (!stepDir) return null;
    const p = path.join(waveDir, stepDir, "spawn.jsonl");
    return (await fileExists(p)) ? p : null;
  }

  // step-{N}-{name}
  const stepMatch = suffix.match(/^step-(\d+)-(.+)$/);
  if (stepMatch) {
    const stepNum = parseInt(stepMatch[1]!, 10);
    const stepName = stepMatch[2]!;
    const dirs = await listDirs(waveDir);
    const stepDir = dirs.find((d) => {
      const m = d.match(/^step-(\d+)-(.+)$/);
      return m && parseInt(m[1]!, 10) === stepNum && m[2] === stepName;
    });
    if (!stepDir) return null;
    const p = path.join(waveDir, stepDir, "spawn.jsonl");
    return (await fileExists(p)) ? p : null;
  }

  return null;
}

/**
 * Read last N non-empty lines from a text file.
 */
async function readLastLines(filePath: string, tail: number): Promise<string[]> {
  const raw = await readFile(filePath, "utf-8");
  const allLines = raw.split("\n").filter((l) => l.trim().length > 0);
  return tail > 0 ? allLines.slice(-tail) : allLines;
}

/**
 * Emit trace events for all spans in a trace (called after build).
 */
function emitTraceEvents(slug: string, trace: PipelineTrace): void {
  const event = `trace:${slug}`;
  for (const span of trace.spans) {
    if (span.status === "running") {
      traceEventBus.emit(event, {
        type: "trace:span-started",
        span_id: span.id,
        name: span.name,
        span_type: span.type,
        trace_id: span.trace_id,
        started_at: span.started_at,
      });
    } else {
      traceEventBus.emit(event, {
        type: "trace:span-completed",
        span_id: span.id,
        name: span.name,
        span_type: span.type,
        trace_id: span.trace_id,
        status: span.status,
        duration_ms: span.duration_ms,
        error: span.error,
      });
      // Emit individual tool call events for agent spans
      for (const tc of span.tool_calls) {
        traceEventBus.emit(event, {
          type: "trace:tool-call",
          span_id: span.id,
          trace_id: span.trace_id,
          tool: tc.tool,
          timestamp: tc.timestamp,
          duration_ms: tc.duration_ms,
          success: tc.success,
        });
      }
    }
  }
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
  const pDir = projectDir(slug);

  if (!(await dirExists(wsDir))) {
    // Fallback: load cached trace.json and emit events (workspace not mounted)
    const cachedPath = path.join(pDir, "traces", `wave-${waveNumber}`, "trace.json");
    try {
      const cached = await readJSON<PipelineTrace>(cachedPath);
      emitTraceEvents(slug, cached);
      return c.json(cached, 200);
    } catch {
      return c.json({ error: "Workspace not found and no cached trace available" }, 404);
    }
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
    pDir
  );

  // Emit live trace events for SSE subscribers
  emitTraceEvents(slug, trace);

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

// GET /hub/projects/:slug/traces/live — SSE stream of live trace events
// Events: trace:span-started, trace:span-completed, trace:tool-call
traces.get("/hub/projects/:slug/traces/live", (c) => {
  const slug = c.req.param("slug");
  const event = `trace:${slug}`;

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ message: "Live trace stream connected", project: slug }),
    });

    const listener = async (payload: Record<string, unknown>) => {
      try {
        await stream.writeSSE({
          event: payload["type"] as string,
          data: JSON.stringify(payload),
        });
      } catch {
        // stream closed
      }
    };

    traceEventBus.on(event, listener);

    stream.onAbort(() => {
      traceEventBus.off(event, listener);
    });

    try {
      while (true) {
        await stream.sleep(30000);
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ ts: new Date().toISOString() }),
        });
      }
    } finally {
      traceEventBus.off(event, listener);
    }
  });
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

// GET /hub/projects/:slug/traces/:traceId/spans/:spanId/log — span raw log lines
// Query: ?tail=100 (default 100 lines)
traces.get("/hub/projects/:slug/traces/:traceId/spans/:spanId/log", async (c) => {
  const slug = c.req.param("slug");
  const traceId = c.req.param("traceId");
  const spanId = c.req.param("spanId");
  const tailParam = c.req.query("tail");
  const tail = tailParam ? Math.max(1, parseInt(tailParam, 10)) : 100;

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Load trace from project data dir (no workspace dir needed)
  const pDir = projectDir(slug);
  let trace: PipelineTrace | null = null;
  const tracesDir = path.join(pDir, "traces");
  const waveDirs = await listDirs(tracesDir).catch(() => [] as string[]);
  for (const waveDir of waveDirs) {
    try {
      const t = await readJSON<PipelineTrace>(path.join(tracesDir, waveDir, "trace.json"));
      if (t.trace_id === traceId) {
        trace = t;
        break;
      }
    } catch {
      // skip
    }
  }

  if (!trace) return c.json({ error: "Trace not found" }, 404);

  const span: TraceSpan | undefined = trace.spans.find((s) => s.id === spanId);
  if (!span) return c.json({ error: "Span not found" }, 404);

  // Use jsonl_path from span metadata (set at build time with absolute path)
  const jsonlPath = typeof span.metadata["jsonl_path"] === "string"
    ? span.metadata["jsonl_path"]
    : null;

  if (!jsonlPath) {
    return c.json({ lines: [] });
  }

  if (!(await fileExists(jsonlPath))) {
    return c.json({ lines: [] });
  }

  const lines = await readLastLines(jsonlPath, tail);
  return c.json({ lines });
});

// GET /hub/projects/:slug/traces/:traceId/spans/:spanId — get span detail
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

// GET /hub/projects/:slug/traces/:traceId — get full trace with spans by trace ID
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

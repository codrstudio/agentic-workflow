import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { EventEmitter } from "node:events";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  PipelineHealthStatusSchema,
  type PipelineHealthStatus,
} from "../schemas/pipeline-health.js";
import { type Project } from "../schemas/project.js";

const pipeline = new Hono();

// In-memory event bus for pipeline SSE events
const pipelineEventBus = new EventEmitter();
pipelineEventBus.setMaxListeners(100);

// ---- helpers ----

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json"),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function pipelineHealthDir(slug: string): string {
  return path.join(projectDir(slug), "pipeline", "health");
}

function waveHealthPath(slug: string, wave: number): string {
  return path.join(pipelineHealthDir(slug), `wave-${wave}.json`);
}

async function loadWaveHealth(
  slug: string,
  wave: number,
): Promise<PipelineHealthStatus | null> {
  try {
    return await readJSON<PipelineHealthStatus>(waveHealthPath(slug, wave));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveWaveHealth(
  slug: string,
  wave: number,
  health: PipelineHealthStatus,
): Promise<void> {
  await ensureDir(pipelineHealthDir(slug));
  await writeJSON(waveHealthPath(slug, wave), health);
}

/** Find the latest wave number for which health data exists. */
async function findLatestWave(slug: string): Promise<number | null> {
  const { readdir } = await import("node:fs/promises");
  try {
    const entries = await readdir(pipelineHealthDir(slug));
    const waveNumbers = entries
      .map((f) => {
        const m = f.match(/^wave-(\d+)\.json$/);
        return m ? parseInt(m[1]!, 10) : null;
      })
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    return waveNumbers.length > 0 ? (waveNumbers[waveNumbers.length - 1] ?? null) : null;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Build a default PipelineHealthStatus for a project.
 * Used when no stored health exists yet.
 */
function buildDefaultHealth(
  projectId: string,
  wave: number,
): PipelineHealthStatus {
  return {
    project_id: projectId,
    wave,
    checked_at: new Date().toISOString(),
    status: "healthy",
    steps: [],
    circuit_breaker: {
      triggered: false,
      trigger_reason: null,
      triggered_at: null,
      consecutive_failures: 0,
      threshold: 3,
    },
  };
}

// ---- routes ----

// GET /hub/projects/:projectId/pipeline/health
pipeline.get("/hub/projects/:projectId/pipeline/health", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const waveParam = c.req.query("wave");
  let wave: number;

  if (waveParam !== undefined) {
    wave = parseInt(waveParam, 10);
    if (isNaN(wave) || wave < 1) {
      return c.json({ error: "Invalid wave number" }, 400);
    }
  } else {
    const latest = await findLatestWave(slug);
    wave = latest ?? 1;
  }

  const existing = await loadWaveHealth(slug, wave);
  if (existing) {
    return c.json(existing);
  }

  // No stored health: return a default
  const defaultHealth = buildDefaultHealth(project.id, wave);
  return c.json(defaultHealth);
});

// POST /hub/projects/:projectId/pipeline/circuit-breaker/reset
pipeline.post(
  "/hub/projects/:projectId/pipeline/circuit-breaker/reset",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const waveParam = c.req.query("wave");
    let wave: number;

    if (waveParam !== undefined) {
      wave = parseInt(waveParam, 10);
      if (isNaN(wave) || wave < 1) {
        return c.json({ error: "Invalid wave number" }, 400);
      }
    } else {
      const latest = await findLatestWave(slug);
      wave = latest ?? 1;
    }

    const existing = await loadWaveHealth(slug, wave);
    const health: PipelineHealthStatus = existing ?? buildDefaultHealth(project.id, wave);

    // Reset circuit breaker
    health.circuit_breaker = {
      ...health.circuit_breaker,
      triggered: false,
      consecutive_failures: 0,
    };
    health.checked_at = new Date().toISOString();

    // Recompute overall status after reset
    if (health.status === "stopped") {
      health.status = health.steps.some((s) => s.health === "dead" || s.health === "failing")
        ? "degraded"
        : "healthy";
    }

    const validated = PipelineHealthStatusSchema.parse(health);
    await saveWaveHealth(slug, wave, validated);

    // Emit SSE event
    pipelineEventBus.emit(`pipeline:${slug}`, {
      event: "pipeline:health-update",
      data: validated,
    });

    return c.json({ reset: true, consecutive_failures: 0 });
  },
);

// POST /hub/projects/:projectId/pipeline/health — update health (engine -> server)
pipeline.post("/hub/projects/:projectId/pipeline/health", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PipelineHealthStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  await saveWaveHealth(slug, parsed.data.wave, parsed.data);

  // Emit SSE event
  pipelineEventBus.emit(`pipeline:${slug}`, {
    event: "pipeline:health-update",
    data: parsed.data,
  });

  return c.json(parsed.data, 201);
});

// GET /hub/projects/:projectId/pipeline/health/stream — SSE stream
pipeline.get("/hub/projects/:projectId/pipeline/health/stream", (c) => {
  const slug = c.req.param("projectId");

  return streamSSE(c, async (stream) => {
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ project: slug, timestamp: new Date().toISOString() }),
    });

    const listener = async (payload: { event: string; data: PipelineHealthStatus }) => {
      try {
        await stream.writeSSE({
          event: payload.event,
          data: JSON.stringify(payload.data),
        });
      } catch {
        // Client disconnected
      }
    };

    pipelineEventBus.on(`pipeline:${slug}`, listener);

    stream.onAbort(() => {
      pipelineEventBus.off(`pipeline:${slug}`, listener);
    });

    while (true) {
      try {
        await stream.writeSSE({
          event: "heartbeat",
          data: JSON.stringify({ timestamp: new Date().toISOString() }),
        });
        await stream.sleep(30000);
      } catch {
        break;
      }
    }

    pipelineEventBus.off(`pipeline:${slug}`, listener);
  });
});

export { pipeline };

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
import {
  CostControlSchema,
  UpdateCostControlSchema,
  type CostControl,
} from "../schemas/pipeline-cost-control.js";
import {
  PipelineRunConfigSchema,
  UpdatePipelineRunConfigSchema,
  type PipelineRunConfig,
} from "../schemas/pipeline-run-config.js";
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

// ---- cost control helpers ----

function costControlPath(slug: string): string {
  return path.join(projectDir(slug), "pipeline", "cost-control.json");
}

async function loadCostControl(slug: string): Promise<CostControl | null> {
  try {
    return await readJSON<CostControl>(costControlPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveCostControl(
  slug: string,
  data: CostControl,
): Promise<void> {
  await ensureDir(path.join(projectDir(slug), "pipeline"));
  await writeJSON(costControlPath(slug), data);
}

function buildDefaultCostControl(projectId: string): CostControl {
  return {
    project_id: projectId,
    budget_limit_usd: null,
    current_spend_usd: 0,
    alert_threshold_percent: 80,
    per_wave_limit_usd: null,
    per_step_limit_usd: null,
    cost_history: [],
    updated_at: new Date().toISOString(),
  };
}

function isAlertThresholdReached(cc: CostControl): boolean {
  if (cc.budget_limit_usd === null || cc.budget_limit_usd <= 0) return false;
  const threshold = (cc.alert_threshold_percent / 100) * cc.budget_limit_usd;
  return cc.current_spend_usd >= threshold;
}

// GET /hub/projects/:projectId/pipeline/cost-control
pipeline.get("/hub/projects/:projectId/pipeline/cost-control", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const existing = await loadCostControl(slug);
  if (existing) return c.json(existing);

  return c.json(buildDefaultCostControl(project.id));
});

// PUT /hub/projects/:projectId/pipeline/cost-control
pipeline.put("/hub/projects/:projectId/pipeline/cost-control", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = UpdateCostControlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const existing = await loadCostControl(slug) ?? buildDefaultCostControl(project.id);

  const updated: CostControl = CostControlSchema.parse({
    ...existing,
    ...Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    ),
    updated_at: new Date().toISOString(),
  });

  await saveCostControl(slug, updated);

  // Emit SSE cost-alert if threshold reached
  if (isAlertThresholdReached(updated)) {
    pipelineEventBus.emit(`pipeline:${slug}`, {
      event: "pipeline:cost-alert",
      data: updated,
    });
  }

  return c.json(updated);
});

// GET /hub/projects/:projectId/pipeline/cost-history
pipeline.get("/hub/projects/:projectId/pipeline/cost-history", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const existing = await loadCostControl(slug);
  const history = existing ? existing.cost_history : [];

  const waveParam = c.req.query("wave");
  const fromParam = c.req.query("from");

  let filtered = history;

  if (waveParam !== undefined) {
    const wave = parseInt(waveParam, 10);
    if (isNaN(wave) || wave < 1) {
      return c.json({ error: "Invalid wave number" }, 400);
    }
    filtered = filtered.filter((e) => e.wave === wave);
  }

  if (fromParam !== undefined) {
    const from = new Date(fromParam);
    if (isNaN(from.getTime())) {
      return c.json({ error: "Invalid from date" }, 400);
    }
    filtered = filtered.filter((e) => new Date(e.timestamp) >= from);
  }

  return c.json({ cost_history: filtered, total: filtered.length });
});

// ---- run config helpers ----

function runConfigPath(slug: string): string {
  return path.join(projectDir(slug), "pipeline", "run-config.json");
}

async function loadRunConfig(slug: string): Promise<PipelineRunConfig | null> {
  try {
    return await readJSON<PipelineRunConfig>(runConfigPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveRunConfig(
  slug: string,
  data: PipelineRunConfig,
): Promise<void> {
  await ensureDir(path.join(projectDir(slug), "pipeline"));
  await writeJSON(runConfigPath(slug), data);
}

function buildDefaultRunConfig(projectId: string): PipelineRunConfig {
  return PipelineRunConfigSchema.parse({
    project_id: projectId,
    circuit_breaker_threshold: 3,
    circuit_breaker_cooldown_minutes: 5,
    step_timeout_minutes: 30,
    wave_timeout_minutes: 180,
    max_retries_per_step: 2,
    max_retries_per_feature: 3,
    retry_backoff_strategy: "fixed",
    notify_on_failure: true,
    notify_on_circuit_break: true,
    notify_on_budget_alert: true,
    updated_at: new Date().toISOString(),
  });
}

// GET /hub/projects/:projectId/pipeline/config
pipeline.get("/hub/projects/:projectId/pipeline/config", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const existing = await loadRunConfig(slug);
  if (existing) return c.json(existing);

  return c.json(buildDefaultRunConfig(project.id));
});

// PUT /hub/projects/:projectId/pipeline/config
pipeline.put("/hub/projects/:projectId/pipeline/config", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = UpdatePipelineRunConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
  }

  const existing = await loadRunConfig(slug) ?? buildDefaultRunConfig(project.id);

  const updated: PipelineRunConfig = PipelineRunConfigSchema.parse({
    ...existing,
    ...Object.fromEntries(
      Object.entries(parsed.data).filter(([, v]) => v !== undefined),
    ),
    updated_at: new Date().toISOString(),
  });

  await saveRunConfig(slug, updated);
  return c.json(updated);
});

export { pipeline };

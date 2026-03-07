import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  TokenUsageRecordSchema,
  CreateTokenUsageBody,
  calculateCostUsd,
  type TokenUsageRecord,
} from "../schemas/token-usage.js";
import { type Project } from "../schemas/project.js";

const tokenUsage = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function tokenUsageDir(slug: string): string {
  return path.join(projectDir(slug), "token-usage");
}

function tokenUsageDayPath(slug: string, date: string): string {
  return path.join(tokenUsageDir(slug), `${date}.json`);
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
): Promise<TokenUsageRecord[]> {
  try {
    return await readJSON<TokenUsageRecord[]>(tokenUsageDayPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayRecords(
  slug: string,
  date: string,
  records: TokenUsageRecord[]
): Promise<void> {
  await ensureDir(tokenUsageDir(slug));
  await writeJSON(tokenUsageDayPath(slug, date), records);
}

async function loadAllRecords(slug: string): Promise<TokenUsageRecord[]> {
  const dir = tokenUsageDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: TokenUsageRecord[] = [];
  for (const file of files) {
    try {
      const dayRecords = await readJSON<TokenUsageRecord[]>(
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

// POST /hub/projects/:slug/token-usage — create record, calculate cost if not provided
tokenUsage.post("/hub/projects/:slug/token-usage", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateTokenUsageBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const data = parsed.data;
  const cost_usd =
    data.cost_usd !== undefined
      ? data.cost_usd
      : calculateCostUsd(
          data.model,
          data.input_tokens,
          data.output_tokens,
          data.cache_read_tokens
        );

  const now = new Date();
  const record: TokenUsageRecord = {
    id: randomUUID(),
    project_id: slug,
    session_id: data.session_id,
    feature_id: data.feature_id,
    phase: data.phase,
    context: data.context,
    model: data.model,
    input_tokens: data.input_tokens,
    output_tokens: data.output_tokens,
    cache_read_tokens: data.cache_read_tokens,
    cost_usd,
    recorded_at: now.toISOString(),
  };

  const dateKey = now.toISOString().slice(0, 10);
  const dayRecords = await loadDayRecords(slug, dateKey);
  dayRecords.push(record);
  await saveDayRecords(slug, dateKey, dayRecords);

  return c.json(record, 201);
});

// GET /hub/projects/:slug/token-usage — list with filters
tokenUsage.get("/hub/projects/:slug/token-usage", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const fromFilter = c.req.query("from");
  const toFilter = c.req.query("to");
  const contextFilter = c.req.query("context");
  const phaseFilter = c.req.query("phase");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 200;

  let records = await loadAllRecords(slug);

  if (fromFilter) {
    records = records.filter((r) => r.recorded_at >= fromFilter);
  }
  if (toFilter) {
    records = records.filter((r) => r.recorded_at <= toFilter);
  }
  if (contextFilter) {
    records = records.filter((r) => r.context === contextFilter);
  }
  if (phaseFilter) {
    records = records.filter((r) => r.phase === phaseFilter);
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

export { tokenUsage };

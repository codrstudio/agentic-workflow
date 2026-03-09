import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir, stat } from "node:fs/promises";
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

// --- Cost summary cache helpers ---

interface CostSummaryCache {
  cached_at: string;
  period_from: string;
  period_to: string;
  top_features: number;
  top_sessions: number;
  data: CostSummaryResponse;
}

interface CostSummaryResponse {
  project_id: string;
  period_from: string;
  period_to: string;
  computed_at: string;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  by_model: Record<string, { cost_usd: number; input_tokens: number; output_tokens: number }>;
  by_phase: Record<string, { cost_usd: number; total_tokens: number }>;
  by_feature: Array<{ feature_id: string; cost_usd: number; total_tokens: number }>;
  by_session: Array<{ session_id: string; cost_usd: number; total_tokens: number }>;
}

function costSummaryCachePath(slug: string): string {
  return path.join(projectDir(slug), "cost-summary-cache.json");
}

async function loadCostSummaryCache(slug: string): Promise<CostSummaryCache | null> {
  try {
    return await readJSON<CostSummaryCache>(costSummaryCachePath(slug));
  } catch {
    return null;
  }
}

function isCacheValid(
  cache: CostSummaryCache,
  from: string,
  to: string,
  topFeatures: number,
  topSessions: number
): boolean {
  if (cache.period_from !== from || cache.period_to !== to) return false;
  if (cache.top_features !== topFeatures || cache.top_sessions !== topSessions) return false;
  const cachedAt = new Date(cache.cached_at).getTime();
  const now = Date.now();
  return now - cachedAt < 5 * 60 * 1000; // 5 minutes TTL
}

function loadRecordsInPeriod(
  records: TokenUsageRecord[],
  from: string,
  to: string
): TokenUsageRecord[] {
  return records.filter((r) => r.recorded_at >= from && r.recorded_at <= to);
}

function computeCostSummary(
  slug: string,
  records: TokenUsageRecord[],
  from: string,
  to: string,
  topFeatures: number,
  topSessions: number
): CostSummaryResponse {
  let total_cost_usd = 0;
  let total_input_tokens = 0;
  let total_output_tokens = 0;
  let total_cache_read_tokens = 0;

  const byModel: Record<string, { cost_usd: number; input_tokens: number; output_tokens: number }> = {};
  const byPhase: Record<string, { cost_usd: number; total_tokens: number }> = {};
  const featureMap: Record<string, { cost_usd: number; total_tokens: number }> = {};
  const sessionMap: Record<string, { cost_usd: number; total_tokens: number }> = {};

  for (const r of records) {
    total_cost_usd += r.cost_usd;
    total_input_tokens += r.input_tokens;
    total_output_tokens += r.output_tokens;
    total_cache_read_tokens += r.cache_read_tokens;

    // by_model
    const model = r.model;
    if (!byModel[model]) byModel[model] = { cost_usd: 0, input_tokens: 0, output_tokens: 0 };
    byModel[model]!.cost_usd += r.cost_usd;
    byModel[model]!.input_tokens += r.input_tokens;
    byModel[model]!.output_tokens += r.output_tokens;

    // by_phase
    const phase = r.phase ?? "unknown";
    if (!byPhase[phase]) byPhase[phase] = { cost_usd: 0, total_tokens: 0 };
    byPhase[phase]!.cost_usd += r.cost_usd;
    byPhase[phase]!.total_tokens += r.input_tokens + r.output_tokens + r.cache_read_tokens;

    // by_feature
    if (r.feature_id) {
      if (!featureMap[r.feature_id]) featureMap[r.feature_id] = { cost_usd: 0, total_tokens: 0 };
      featureMap[r.feature_id]!.cost_usd += r.cost_usd;
      featureMap[r.feature_id]!.total_tokens += r.input_tokens + r.output_tokens + r.cache_read_tokens;
    }

    // by_session
    if (r.session_id) {
      if (!sessionMap[r.session_id]) sessionMap[r.session_id] = { cost_usd: 0, total_tokens: 0 };
      sessionMap[r.session_id]!.cost_usd += r.cost_usd;
      sessionMap[r.session_id]!.total_tokens += r.input_tokens + r.output_tokens + r.cache_read_tokens;
    }
  }

  const by_feature = Object.entries(featureMap)
    .map(([feature_id, v]) => ({ feature_id, ...v }))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, topFeatures);

  const by_session = Object.entries(sessionMap)
    .map(([session_id, v]) => ({ session_id, ...v }))
    .sort((a, b) => b.cost_usd - a.cost_usd)
    .slice(0, topSessions);

  return {
    project_id: slug,
    period_from: from,
    period_to: to,
    computed_at: new Date().toISOString(),
    total_cost_usd,
    total_input_tokens,
    total_output_tokens,
    total_cache_read_tokens,
    by_model: byModel,
    by_phase: byPhase,
    by_feature,
    by_session,
  };
}

// GET /hub/projects/:slug/cost-summary — aggregated cost summary with cache
tokenUsage.get("/hub/projects/:slug/cost-summary", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const from = c.req.query("from") ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = c.req.query("to") ?? new Date().toISOString();
  const topFeatures = parseInt(c.req.query("top_features") ?? "10", 10);
  const topSessions = parseInt(c.req.query("top_sessions") ?? "5", 10);

  // Check cache
  const cache = await loadCostSummaryCache(slug);
  if (cache && isCacheValid(cache, from, to, topFeatures, topSessions)) {
    return c.json(cache.data);
  }

  // Compute fresh
  const allRecords = await loadAllRecords(slug);
  const periodRecords = loadRecordsInPeriod(allRecords, from, to);
  const summary = computeCostSummary(slug, periodRecords, from, to, topFeatures, topSessions);

  // Save cache
  const cacheData: CostSummaryCache = {
    cached_at: new Date().toISOString(),
    period_from: from,
    period_to: to,
    top_features: topFeatures,
    top_sessions: topSessions,
    data: summary,
  };
  await ensureDir(projectDir(slug));
  await writeJSON(costSummaryCachePath(slug), cacheData);

  return c.json(summary);
});

// GET /hub/projects/:slug/model-recommendations — static recommendations per phase
tokenUsage.get("/hub/projects/:slug/model-recommendations", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const recommendations = [
    { phase: "brainstorming", recommended_model: "claude-haiku-4-5", rationale: "Low-cost model sufficient for ideation and brainstorming", cost_tier: "low", quality_tier: "standard" },
    { phase: "specs", recommended_model: "claude-sonnet-4-6", rationale: "Premium quality needed for precise specification derivation", cost_tier: "medium", quality_tier: "premium" },
    { phase: "prps", recommended_model: "claude-sonnet-4-6", rationale: "Premium quality needed for detailed PRP generation", cost_tier: "medium", quality_tier: "premium" },
    { phase: "implementation", recommended_model: "claude-sonnet-4-6", rationale: "Premium quality for code generation and implementation", cost_tier: "medium", quality_tier: "premium" },
    { phase: "review", recommended_model: "claude-sonnet-4-6", rationale: "Premium quality for thorough code review", cost_tier: "medium", quality_tier: "premium" },
    { phase: "merge", recommended_model: "claude-haiku-4-5", rationale: "Low-cost model sufficient for merge conflict resolution", cost_tier: "low", quality_tier: "standard" },
  ];

  return c.json(recommendations);
});

// GET /hub/projects/:slug/token-usage/features/:featureId — cost detail for a specific feature
tokenUsage.get("/hub/projects/:slug/token-usage/features/:featureId", async (c) => {
  const slug = c.req.param("slug");
  const featureId = c.req.param("featureId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const allRecords = await loadAllRecords(slug);
  const featureRecords = allRecords.filter((r) => r.feature_id === featureId);

  const total_cost_usd = featureRecords.reduce((sum, r) => sum + r.cost_usd, 0);
  const total_tokens = featureRecords.reduce(
    (sum, r) => sum + r.input_tokens + r.output_tokens + r.cache_read_tokens,
    0
  );

  return c.json({
    feature_id: featureId,
    total_cost_usd,
    total_tokens,
    records: featureRecords,
  });
});

export { tokenUsage };

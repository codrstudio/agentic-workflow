import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  FeatureVerificationRecordSchema,
  CreateVerificationRecordBodySchema,
  PatchVerificationRecordBodySchema,
  type FeatureVerificationRecord,
  type VerificationDebtMetrics,
  type DebtHistoryPoint,
  DebtMetricsCacheSchema,
} from "../schemas/verification-record.js";
import { type Project } from "../schemas/project.js";

const verificationRecords = new Hono();

// ---- helpers ----

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function verificationDir(slug: string): string {
  return path.join(projectDir(slug), "verification", "records");
}

function recordPath(slug: string, featureId: string): string {
  return path.join(verificationDir(slug), `${featureId}.json`);
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

async function loadRecord(
  slug: string,
  featureId: string,
): Promise<FeatureVerificationRecord | null> {
  try {
    return await readJSON<FeatureVerificationRecord>(
      recordPath(slug, featureId),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function listAllRecords(
  slug: string,
): Promise<FeatureVerificationRecord[]> {
  const dir = verificationDir(slug);
  try {
    const files = await readdir(dir);
    const records: FeatureVerificationRecord[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const rec = await readJSON<FeatureVerificationRecord>(
          path.join(dir, file),
        );
        records.push(rec);
      } catch {
        // skip corrupt files
      }
    }
    return records;
  } catch {
    return [];
  }
}

function computeCoverage(linesReviewed: number, linesGenerated: number): number {
  if (linesGenerated === 0) return 0;
  return Math.min(1, linesReviewed / linesGenerated);
}

// ---- GET /api/v1/hub/projects/:projectId/verification/records ----

verificationRecords.get(
  "/hub/projects/:projectId/verification/records",
  async (c) => {
    const projectId = c.req.param("projectId");
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const sprintFilter = c.req.query("sprint");
    const attributionFilter = c.req.query("attribution");
    const reworkedFilter = c.req.query("reworked");
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    let records = await listAllRecords(projectId);

    if (sprintFilter !== undefined) {
      const sprint = parseInt(sprintFilter, 10);
      records = records.filter((r) => r.sprint === sprint);
    }

    if (attributionFilter !== undefined) {
      records = records.filter((r) => r.attribution === attributionFilter);
    }

    if (reworkedFilter !== undefined) {
      const reworked = reworkedFilter === "true";
      records = records.filter((r) => r.reworked === reworked);
    }

    // Sort by created_at desc, then apply limit
    records.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    records = records.slice(0, limit);

    return c.json(records);
  },
);

// ---- POST /api/v1/hub/projects/:projectId/verification/records/:featureId ----

verificationRecords.post(
  "/hub/projects/:projectId/verification/records/:featureId",
  async (c) => {
    const projectId = c.req.param("projectId");
    const featureId = c.req.param("featureId");

    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = CreateVerificationRecordBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const record: FeatureVerificationRecord = {
      feature_id: featureId,
      project_id: data.project_id,
      sprint: data.sprint,
      attribution: data.attribution,
      lines_generated: data.lines_generated,
      lines_reviewed: data.lines_reviewed,
      review_coverage: computeCoverage(data.lines_reviewed, data.lines_generated),
      review_iterations: data.review_iterations,
      first_pass: data.first_pass,
      reworked: data.reworked,
      rework_reason: data.rework_reason,
      review_agents_used: data.review_agents_used,
      human_review_time_minutes: data.human_review_time_minutes,
      verified_at: data.verified_at,
      created_at: now,
    };

    await ensureDir(verificationDir(projectId));
    await writeJSON(recordPath(projectId, featureId), record);

    return c.json(record, 201);
  },
);

// ---- PATCH /api/v1/hub/projects/:projectId/verification/records/:featureId ----

verificationRecords.patch(
  "/hub/projects/:projectId/verification/records/:featureId",
  async (c) => {
    const projectId = c.req.param("projectId");
    const featureId = c.req.param("featureId");

    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const existing = await loadRecord(projectId, featureId);
    if (!existing) {
      return c.json({ error: "Verification record not found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchVerificationRecordBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
    }

    const patch = parsed.data;
    const updated: FeatureVerificationRecord = {
      ...existing,
      ...patch,
    };

    // Recompute review_coverage if lines changed
    const linesGenerated =
      patch.lines_generated !== undefined
        ? patch.lines_generated
        : existing.lines_generated;
    const linesReviewed =
      patch.lines_reviewed !== undefined
        ? patch.lines_reviewed
        : existing.lines_reviewed;
    updated.review_coverage = computeCoverage(linesReviewed, linesGenerated);

    await writeJSON(recordPath(projectId, featureId), updated);

    return c.json(updated);
  },
);

// ---- Debt metrics helpers ----

const DEBT_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function debtCachePath(slug: string): string {
  return path.join(projectDir(slug), "verification", "debt-metrics-cache.json");
}

function debtHistoryPath(slug: string): string {
  return path.join(projectDir(slug), "verification", "debt-history.json");
}

/** Week start (Monday) for a given date string */
function weekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Pearson correlation between two arrays, returns 0 if insufficient data */
function pearsonCorrelation(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, denX = 0, denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - meanX;
    const dy = ys[i]! - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  return den === 0 ? 0 : Math.max(-1, Math.min(1, num / den));
}

function computeDebtScore(
  firstPassRate: number,  // 0-100
  reworkRatio: number,    // 0-100
  unreviewedCount: number,
): number {
  // base=100, subtract for high first_pass_rate (good), add for rework and unreviewed (bad)
  const score =
    100 -
    firstPassRate * 0.5 +       // -50 when first_pass_rate=100 (perfect)
    reworkRatio * 0.3 +          // +30 when rework_ratio=100 (worst)
    Math.min(20, unreviewedCount * 2); // +up to 20 for unreviewed
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

function computeMetrics(
  records: FeatureVerificationRecord[],
  previousScore: number | null,
): VerificationDebtMetrics {
  const now = new Date().toISOString();
  const total = records.length;

  if (total === 0) {
    return {
      total_features_reviewed: 0,
      first_pass_acceptance_rate: 0,
      rework_ratio: 0,
      avg_review_iterations: 0,
      ai_generated_features: 0,
      human_generated_features: 0,
      ai_rework_rate: 0,
      human_rework_rate: 0,
      attribution_gap: 0,
      unreviewed_count: 0,
      stale_review_count: 0,
      debt_score: 0,
      debt_trend: "stable",
      features_per_week: 0,
      quality_score_per_week: 0,
      velocity_quality_correlation: 0,
      computed_at: now,
    };
  }

  // first_pass_acceptance_rate
  const firstPassCount = records.filter((r) => r.first_pass).length;
  const firstPassRate = (firstPassCount / total) * 100;

  // rework_ratio
  const reworkedCount = records.filter((r) => r.reworked).length;
  const reworkRatio = (reworkedCount / total) * 100;

  // avg_review_iterations
  const totalIterations = records.reduce((s, r) => s + r.review_iterations, 0);
  const avgIterations = totalIterations / total;

  // AI vs human
  const aiRecords = records.filter((r) => r.attribution !== "human");
  const humanRecords = records.filter((r) => r.attribution === "human");
  const aiCount = aiRecords.length;
  const humanCount = humanRecords.length;

  const aiReworkCount = aiRecords.filter((r) => r.reworked).length;
  const humanReworkCount = humanRecords.filter((r) => r.reworked).length;
  const aiReworkRate = aiCount > 0 ? (aiReworkCount / aiCount) * 100 : 0;
  const humanReworkRate = humanCount > 0 ? (humanReworkCount / humanCount) * 100 : 0;
  const attributionGap = aiReworkRate - humanReworkRate;

  // stale: verified_at older than 30 days
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const staleCount = records.filter((r) => {
    if (!r.verified_at) return false;
    return new Date(r.verified_at).getTime() < thirtyDaysAgo;
  }).length;

  // unreviewed: records with verified_at=null
  const unreviewedCount = records.filter((r) => r.verified_at === null).length;

  // debt_score
  const debtScore = computeDebtScore(firstPassRate, reworkRatio, unreviewedCount);

  // debt_trend: compare with previous score
  let debtTrend: "improving" | "stable" | "worsening" = "stable";
  if (previousScore !== null) {
    if (debtScore < previousScore - 2) debtTrend = "improving";
    else if (debtScore > previousScore + 2) debtTrend = "worsening";
  }

  // Weekly aggregation (by created_at)
  const byWeek = new Map<string, FeatureVerificationRecord[]>();
  for (const r of records) {
    const wk = weekStart(r.created_at);
    const bucket = byWeek.get(wk) ?? [];
    bucket.push(r);
    byWeek.set(wk, bucket);
  }
  const weeks = Array.from(byWeek.keys()).sort();
  const latestWeek = weeks[weeks.length - 1];
  const latestRecords = latestWeek ? (byWeek.get(latestWeek) ?? []) : [];
  const featuresPerWeek = latestRecords.length;
  const qualityScorePerWeek =
    latestRecords.length > 0
      ? (latestRecords.filter((r) => r.first_pass).length / latestRecords.length) * 100
      : 0;

  // velocity_quality_correlation: features/week vs quality/week
  const velocities: number[] = [];
  const qualities: number[] = [];
  for (const wk of weeks) {
    const wkRecords = byWeek.get(wk)!;
    velocities.push(wkRecords.length);
    qualities.push(
      wkRecords.length > 0
        ? (wkRecords.filter((r) => r.first_pass).length / wkRecords.length) * 100
        : 0,
    );
  }
  const correlation = pearsonCorrelation(velocities, qualities);

  return {
    total_features_reviewed: total,
    first_pass_acceptance_rate: Math.round(firstPassRate * 10) / 10,
    rework_ratio: Math.round(reworkRatio * 10) / 10,
    avg_review_iterations: Math.round(avgIterations * 100) / 100,
    ai_generated_features: aiCount,
    human_generated_features: humanCount,
    ai_rework_rate: Math.round(aiReworkRate * 10) / 10,
    human_rework_rate: Math.round(humanReworkRate * 10) / 10,
    attribution_gap: Math.round(attributionGap * 10) / 10,
    unreviewed_count: unreviewedCount,
    stale_review_count: staleCount,
    debt_score: debtScore,
    debt_trend: debtTrend,
    features_per_week: featuresPerWeek,
    quality_score_per_week: Math.round(qualityScorePerWeek * 10) / 10,
    velocity_quality_correlation: Math.round(correlation * 1000) / 1000,
    computed_at: now,
  };
}

// ---- GET /api/v1/hub/projects/:projectId/verification/metrics ----

verificationRecords.get(
  "/hub/projects/:projectId/verification/metrics",
  async (c) => {
    const projectId = c.req.param("projectId");
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const fromFilter = c.req.query("from");
    const toFilter = c.req.query("to");

    // Try cache (only when no date filters)
    if (!fromFilter && !toFilter) {
      try {
        const cached = await readJSON<unknown>(debtCachePath(projectId));
        const parsedCache = DebtMetricsCacheSchema.safeParse(cached);
        if (parsedCache.success) {
          const age = Date.now() - new Date(parsedCache.data.cached_at).getTime();
          if (age < DEBT_CACHE_TTL_MS) {
            return c.json(parsedCache.data.metrics);
          }
        }
      } catch {
        // no cache
      }
    }

    let records = await listAllRecords(projectId);

    // Date filters
    if (fromFilter) {
      const from = new Date(fromFilter).getTime();
      records = records.filter((r) => new Date(r.created_at).getTime() >= from);
    }
    if (toFilter) {
      const to = new Date(toFilter).getTime();
      records = records.filter((r) => new Date(r.created_at).getTime() <= to);
    }

    // Get previous cached score for trend computation
    let previousScore: number | null = null;
    try {
      const cached = await readJSON<unknown>(debtCachePath(projectId));
      const parsedCache = DebtMetricsCacheSchema.safeParse(cached);
      if (parsedCache.success) {
        previousScore = parsedCache.data.metrics.debt_score;
      }
    } catch {
      // no previous
    }

    const metrics = computeMetrics(records, previousScore);

    // Persist cache + append history point (only when no date filters)
    if (!fromFilter && !toFilter) {
      await ensureDir(path.join(projectDir(projectId), "verification"));
      await writeJSON(debtCachePath(projectId), {
        metrics,
        cached_at: metrics.computed_at,
      });

      // Append to debt history
      let history: DebtHistoryPoint[] = [];
      try {
        history = await readJSON<DebtHistoryPoint[]>(debtHistoryPath(projectId));
        if (!Array.isArray(history)) history = [];
      } catch {
        // start fresh
      }
      const todayKey = metrics.computed_at.slice(0, 10);
      // Replace existing entry for today or append
      const idx = history.findIndex((p) => p.date === todayKey);
      const point: DebtHistoryPoint = {
        date: todayKey,
        debt_score: metrics.debt_score,
        rework_ratio: metrics.rework_ratio,
      };
      if (idx >= 0) {
        history[idx] = point;
      } else {
        history.push(point);
      }
      await writeJSON(debtHistoryPath(projectId), history);
    }

    return c.json(metrics);
  },
);

// ---- GET /api/v1/hub/projects/:projectId/verification/debt-history ----

verificationRecords.get(
  "/hub/projects/:projectId/verification/debt-history",
  async (c) => {
    const projectId = c.req.param("projectId");
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const fromFilter = c.req.query("from");
    const toFilter = c.req.query("to");
    // interval=weekly is the only supported interval for now; daily/monthly could be added later

    let history: DebtHistoryPoint[] = [];
    try {
      history = await readJSON<DebtHistoryPoint[]>(debtHistoryPath(projectId));
      if (!Array.isArray(history)) history = [];
    } catch {
      // no history yet — compute from records grouped by week
    }

    // If no persisted history, compute from records
    if (history.length === 0) {
      const records = await listAllRecords(projectId);
      const byWeek = new Map<string, FeatureVerificationRecord[]>();
      for (const r of records) {
        const wk = weekStart(r.created_at);
        const bucket = byWeek.get(wk) ?? [];
        bucket.push(r);
        byWeek.set(wk, bucket);
      }
      const weeks = Array.from(byWeek.keys()).sort();
      let prevScore: number | null = null;
      for (const wk of weeks) {
        const wkRecords = byWeek.get(wk)!;
        const m = computeMetrics(wkRecords, prevScore);
        history.push({ date: wk, debt_score: m.debt_score, rework_ratio: m.rework_ratio });
        prevScore = m.debt_score;
      }
    }

    // Apply date filters
    if (fromFilter) {
      const from = new Date(fromFilter).getTime();
      history = history.filter((p) => new Date(p.date).getTime() >= from);
    }
    if (toFilter) {
      const to = new Date(toFilter).getTime();
      history = history.filter((p) => new Date(p.date).getTime() <= to);
    }

    history.sort((a, b) => a.date.localeCompare(b.date));

    return c.json({ points: history });
  },
);

export { verificationRecords };

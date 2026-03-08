import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ROIConfigSchema,
  ROISnapshotSchema,
  PutROIConfigBody,
  CreateROISnapshotBody,
  type ROIConfig,
  type ROISnapshot,
  type AIROIMetrics,
  type SprintROI,
} from "../schemas/roi.js";
import { type Project } from "../schemas/project.js";
import { type TokenUsageRecord } from "../schemas/token-usage.js";
import { type FeatureCycleRecord } from "../schemas/feature-cycle.js";

const roi = new Hono();

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

function roiConfigPath(slug: string): string {
  return path.join(projectDir(slug), "roi-config.json");
}

function roiSnapshotsDirPath(slug: string): string {
  return path.join(projectDir(slug), "roi-snapshots");
}

function roiSnapshotPath(slug: string, date: string): string {
  return path.join(roiSnapshotsDirPath(slug), `${date}.json`);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadROIConfig(slug: string, projectId: string): Promise<ROIConfig> {
  try {
    return await readJSON<ROIConfig>(roiConfigPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      // Return defaults
      return {
        project_id: projectId,
        developer_hourly_rate_usd: 75,
        baseline_hours_per_feature: 8,
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

// GET /hub/projects/:projectId/roi/config
roi.get("/hub/projects/:projectId/roi/config", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const cfg = await loadROIConfig(slug, project.id);
  return c.json(cfg);
});

// PUT /hub/projects/:projectId/roi/config
roi.put("/hub/projects/:projectId/roi/config", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PutROIConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const existing = await loadROIConfig(slug, project.id);
  const updated: ROIConfig = {
    ...existing,
    ...(parsed.data.developer_hourly_rate_usd !== undefined && {
      developer_hourly_rate_usd: parsed.data.developer_hourly_rate_usd,
    }),
    ...(parsed.data.baseline_hours_per_feature !== undefined && {
      baseline_hours_per_feature: parsed.data.baseline_hours_per_feature,
    }),
    updated_at: new Date().toISOString(),
  };

  const validated = ROIConfigSchema.safeParse(updated);
  if (!validated.success) {
    return c.json({ error: "Config construction failed", details: validated.error.issues }, 500);
  }

  await writeJSON(roiConfigPath(slug), validated.data);
  return c.json(validated.data);
});

// GET /hub/projects/:projectId/roi/snapshots?from=&to=
roi.get("/hub/projects/:projectId/roi/snapshots", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const fromFilter = c.req.query("from");
  const toFilter = c.req.query("to");

  const dir = roiSnapshotsDirPath(slug);
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

  const snapshots: ROISnapshot[] = [];
  for (const file of files) {
    const dateKey = file.replace(".json", "");
    if (fromFilter && dateKey < fromFilter) continue;
    if (toFilter && dateKey > toFilter) continue;
    try {
      const snap = await readJSON<ROISnapshot>(path.join(dir, file));
      snapshots.push(snap);
    } catch {
      // skip malformed
    }
  }

  // Sort by date asc
  snapshots.sort((a, b) => a.date.localeCompare(b.date));

  return c.json(snapshots);
});

// POST /hub/projects/:projectId/roi/snapshots
roi.post("/hub/projects/:projectId/roi/snapshots", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateROISnapshotBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const date = parsed.data.date ?? todayDate();
  const id = randomUUID();
  const now = new Date().toISOString();

  const snapshot: ROISnapshot = {
    id,
    project_id: project.id,
    date,
    roi_ratio: parsed.data.roi_ratio,
    cost_per_feature_usd: parsed.data.cost_per_feature_usd,
    first_pass_accuracy: parsed.data.first_pass_accuracy,
    rework_ratio: parsed.data.rework_ratio,
    total_cost_usd: parsed.data.total_cost_usd,
    features_completed: parsed.data.features_completed,
    created_at: now,
  };

  const validated = ROISnapshotSchema.safeParse(snapshot);
  if (!validated.success) {
    return c.json({ error: "Snapshot construction failed", details: validated.error.issues }, 500);
  }

  await ensureDir(roiSnapshotsDirPath(slug));
  await writeJSON(roiSnapshotPath(slug, date), validated.data);

  return c.json(validated.data, 201);
});

// --- Cache for metrics (10 min TTL) ---
const metricsCache = new Map<string, { data: AIROIMetrics; expiresAt: number }>();

// --- Helper: load all token-usage records for a period ---
async function loadTokenUsageForPeriod(
  slug: string,
  periodStart: Date
): Promise<TokenUsageRecord[]> {
  const dir = path.join(config.projectsDir, slug, "token-usage");
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }

  const periodStartDate = periodStart.toISOString().slice(0, 10);
  const relevantFiles = files.filter((f) => f.replace(".json", "") >= periodStartDate);

  const all: TokenUsageRecord[] = [];
  for (const file of relevantFiles) {
    try {
      const records = await readJSON<TokenUsageRecord[]>(
        path.join(dir, file)
      );
      all.push(...records);
    } catch {
      // skip malformed
    }
  }

  // Filter by actual recorded_at timestamp
  return all.filter((r) => new Date(r.recorded_at) >= periodStart);
}

// --- Helper: load all feature-cycle records ---
async function loadAllFeatureCycles(slug: string): Promise<FeatureCycleRecord[]> {
  const dir = path.join(config.projectsDir, slug, "feature-cycles");
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
  const cycles: FeatureCycleRecord[] = [];
  for (const file of files) {
    try {
      const cycle = await readJSON<FeatureCycleRecord>(path.join(dir, file));
      cycles.push(cycle);
    } catch {
      // skip malformed
    }
  }
  return cycles;
}

// --- Compute AIROIMetrics ---
async function computeAIROIMetrics(
  slug: string,
  periodDays: number
): Promise<AIROIMetrics> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Load project for roi-config
  const project = await loadProject(slug);
  const projectId = project?.id ?? slug;

  const roiCfg = await loadROIConfig(slug, projectId);
  const tokenRecords = await loadTokenUsageForPeriod(slug, periodStart);
  const allCycles = await loadAllFeatureCycles(slug);

  // Filter cycles within period (by started_at or completed_at)
  const periodCycles = allCycles.filter((c) => {
    const t = c.completed_at ?? c.started_at;
    return new Date(t) >= periodStart;
  });

  const completedCycles = periodCycles.filter((c) => c.status === "completed");

  // --- core_roi ---
  const totalCostUsd = tokenRecords.reduce((s, r) => s + r.cost_usd, 0);
  const featuresCompleted = completedCycles.length;

  const firstPassCount = completedCycles.filter((c) => c.first_pass).length;
  const firstPassAccuracy = featuresCompleted > 0 ? firstPassCount / featuresCompleted : 0;

  const costPerFeatureUsd = featuresCompleted > 0 ? totalCostUsd / featuresCompleted : 0;
  const estimatedDevHoursSaved =
    featuresCompleted * roiCfg.baseline_hours_per_feature * firstPassAccuracy;
  const estimatedDevCostSavedUsd =
    estimatedDevHoursSaved * roiCfg.developer_hourly_rate_usd;
  const roiRatio = totalCostUsd > 0 ? estimatedDevCostSavedUsd / totalCostUsd : 0;

  // --- ai_quality ---
  const reworkCount = periodCycles.filter((c) => c.attempts > 1).length;
  const aiReworkRatio =
    periodCycles.length > 0 ? reworkCount / periodCycles.length : 0;

  // --- cost_trend ---
  const currentWeekCost = tokenRecords
    .filter((r) => new Date(r.recorded_at) >= weekAgo)
    .reduce((s, r) => s + r.cost_usd, 0);

  const previousWeekCost = tokenRecords
    .filter((r) => {
      const t = new Date(r.recorded_at);
      return t >= twoWeeksAgo && t < weekAgo;
    })
    .reduce((s, r) => s + r.cost_usd, 0);

  const changePct =
    previousWeekCost > 0
      ? ((currentWeekCost - previousWeekCost) / previousWeekCost) * 100
      : currentWeekCost > 0
      ? 100
      : 0;

  // --- by_model ---
  // Group token records by model
  const modelMap = new Map<
    string,
    { cost_usd: number; featureIds: Set<string> }
  >();
  for (const r of tokenRecords) {
    const model = r.model;
    if (!modelMap.has(model)) {
      modelMap.set(model, { cost_usd: 0, featureIds: new Set() });
    }
    const entry = modelMap.get(model)!;
    entry.cost_usd += r.cost_usd;
    if (r.feature_id) entry.featureIds.add(r.feature_id);
  }

  // Build feature lookup for cycle data
  const cycleByFeatureId = new Map<string, FeatureCycleRecord>();
  for (const c of allCycles) {
    cycleByFeatureId.set(c.feature_id, c);
  }

  const byModel = Array.from(modelMap.entries()).map(([model, entry]) => {
    const featuresArr = Array.from(entry.featureIds)
      .map((fid) => cycleByFeatureId.get(fid))
      .filter((c): c is FeatureCycleRecord => c !== undefined);

    const featureCount = entry.featureIds.size;
    const firstPassRateModel =
      featuresArr.length > 0
        ? featuresArr.filter((c) => c.first_pass).length / featuresArr.length
        : 0;
    const completedWithTime = featuresArr.filter(
      (c) => c.cycle_time_hours !== null
    );
    const avgCycleTime =
      completedWithTime.length > 0
        ? completedWithTime.reduce((s, c) => s + (c.cycle_time_hours ?? 0), 0) /
          completedWithTime.length
        : 0;

    return {
      model,
      cost_usd: Math.round(entry.cost_usd * 1e6) / 1e6,
      features: featureCount,
      first_pass_rate: firstPassRateModel,
      avg_cycle_time: avgCycleTime,
    };
  });

  return {
    core_roi: {
      total_cost_usd: Math.round(totalCostUsd * 1e6) / 1e6,
      cost_per_feature_usd: Math.round(costPerFeatureUsd * 1e6) / 1e6,
      features_completed: featuresCompleted,
      estimated_dev_hours_saved: Math.round(estimatedDevHoursSaved * 100) / 100,
      estimated_dev_cost_saved_usd:
        Math.round(estimatedDevCostSavedUsd * 100) / 100,
      roi_ratio: Math.round(roiRatio * 1000) / 1000,
    },
    ai_quality: {
      ai_rework_ratio: Math.round(aiReworkRatio * 1000) / 1000,
      first_pass_accuracy: Math.round(firstPassAccuracy * 1000) / 1000,
      ai_vs_human_defect_rate: null,
    },
    cost_trend: {
      current_week: Math.round(currentWeekCost * 1e6) / 1e6,
      previous_week: Math.round(previousWeekCost * 1e6) / 1e6,
      change_pct: Math.round(changePct * 100) / 100,
    },
    by_model: byModel,
    period_days: periodDays,
    computed_at: now.toISOString(),
  };
}

// GET /hub/projects/:projectId/roi/metrics?period_days=30
roi.get("/hub/projects/:projectId/roi/metrics", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const periodDays = parseInt(c.req.query("period_days") ?? "30", 10);
  const cacheKey = `${slug}:${periodDays}`;
  const now = Date.now();

  const cached = metricsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return c.json(cached.data);
  }

  const metrics = await computeAIROIMetrics(slug, periodDays);
  metricsCache.set(cacheKey, { data: metrics, expiresAt: now + 10 * 60 * 1000 });

  return c.json(metrics);
});

// GET /hub/projects/:projectId/roi/by-sprint
roi.get("/hub/projects/:projectId/roi/by-sprint", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const allCycles = await loadAllFeatureCycles(slug);
  const allTokenRecords = await loadTokenUsageForPeriod(slug, new Date(0));

  // Build feature_id -> token cost map
  const featureCostMap = new Map<string, number>();
  for (const r of allTokenRecords) {
    if (r.feature_id) {
      featureCostMap.set(
        r.feature_id,
        (featureCostMap.get(r.feature_id) ?? 0) + r.cost_usd
      );
    }
  }

  // Group cycles by sprint
  const sprintMap = new Map<
    number,
    { cycles: FeatureCycleRecord[]; totalCost: number }
  >();
  for (const cycle of allCycles) {
    if (!sprintMap.has(cycle.sprint)) {
      sprintMap.set(cycle.sprint, { cycles: [], totalCost: 0 });
    }
    const entry = sprintMap.get(cycle.sprint)!;
    entry.cycles.push(cycle);
    entry.totalCost += featureCostMap.get(cycle.feature_id) ?? 0;
  }

  const roiCfg = await loadROIConfig(slug, project.id);

  const result: SprintROI[] = [];
  for (const [sprint, { cycles, totalCost }] of sprintMap.entries()) {
    const completed = cycles.filter((c) => c.status === "completed");
    const features = completed.length;
    const firstPassCount = completed.filter((c) => c.first_pass).length;
    const firstPassRate = features > 0 ? firstPassCount / features : 0;
    const costPerFeature = features > 0 ? totalCost / features : 0;

    const estimatedDevHours = features * roiCfg.baseline_hours_per_feature * firstPassRate;
    const estimatedDevCostSaved =
      estimatedDevHours * roiCfg.developer_hourly_rate_usd;
    const roiRatio = totalCost > 0 ? estimatedDevCostSaved / totalCost : 0;

    result.push({
      sprint,
      roi_ratio: Math.round(roiRatio * 1000) / 1000,
      cost_per_feature: Math.round(costPerFeature * 1e6) / 1e6,
      features,
      first_pass_rate: Math.round(firstPassRate * 1000) / 1000,
      total_cost_usd: Math.round(totalCost * 1e6) / 1e6,
    });
  }

  result.sort((a, b) => a.sprint - b.sprint);

  return c.json(result);
});

export { roi };

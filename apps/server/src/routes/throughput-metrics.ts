import { Hono } from "hono";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { type FeatureCycleRecord } from "../schemas/feature-cycle.js";
import {
  type ThroughputMetrics,
  type BottleneckEntry,
} from "../schemas/throughput-metrics.js";
import { type Project } from "../schemas/project.js";

const throughputMetrics = new Hono();

// In-memory metrics cache: cacheKey -> { metrics, expiresAt }
const metricsCache = new Map<
  string,
  { metrics: ThroughputMetrics; expiresAt: number }
>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

async function loadAllCycles(slug: string): Promise<FeatureCycleRecord[]> {
  const dir = path.join(projectDir(slug), "feature-cycles");
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }
  return Promise.all(
    files.map((f) => readJSON<FeatureCycleRecord>(path.join(dir, f)))
  );
}

function isoWeekLabel(date: Date): string {
  // Returns "YYYY-Www" for the given date
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // ISO week: Monday-based
  const dayNum = d.getUTCDay() || 7; // make Sunday = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function computeMetrics(
  cycles: FeatureCycleRecord[],
  periodDays: number
): ThroughputMetrics {
  const now = Date.now();
  const periodStart = now - periodDays * 24 * 60 * 60 * 1000;

  // Filter cycles within period (by started_at)
  const inPeriod = cycles.filter(
    (c) => new Date(c.started_at).getTime() >= periodStart
  );

  // Feature level metrics
  const completed = inPeriod.filter((c) => c.status === "completed").length;
  const inProgress = inPeriod.filter((c) => c.status === "in_progress").length;
  const blocked = inPeriod.filter((c) => c.status === "blocked" as string).length;
  const failed = inPeriod.filter((c) => c.status === "failed").length;

  const completedWithTime = inPeriod.filter(
    (c) => c.status === "completed" && c.cycle_time_hours !== null
  );
  const avgCycleTimeHours =
    completedWithTime.length > 0
      ? completedWithTime.reduce((sum, c) => sum + (c.cycle_time_hours ?? 0), 0) /
        completedWithTime.length
      : null;

  const total = inPeriod.length;
  const firstPassRate =
    total > 0
      ? inPeriod.filter((c) => c.first_pass === true).length / total
      : 0;

  // AI effectiveness
  const aiLevels = ["none", "partial", "majority", "full"] as const;
  const delegationRatio = {
    none: 0,
    partial: 0,
    majority: 0,
    full: 0,
  };
  if (total > 0) {
    for (const level of aiLevels) {
      delegationRatio[level] =
        inPeriod.filter((c) => c.ai_contribution === level).length / total;
    }
  }

  const reworkRatio =
    total > 0
      ? inPeriod.filter((c) => c.attempts > 1).length / total
      : 0;

  // human_intervention_rate: cycles where review_iterations > 0
  const humanInterventionRate =
    total > 0
      ? inPeriod.filter((c) => c.review_iterations > 0).length / total
      : 0;

  // Quality: review_pass_rate = first_pass_rate (features that passed without rework in review)
  // Completed on first_pass out of all completed
  const completedCycles = inPeriod.filter((c) => c.status === "completed");
  const reviewPassRate =
    completedCycles.length > 0
      ? completedCycles.filter((c) => c.first_pass === true).length /
        completedCycles.length
      : 0;

  // features_per_week: group completed cycles by ISO week of completed_at
  const weekCounts = new Map<string, number>();
  for (const c of inPeriod) {
    if (c.status === "completed" && c.completed_at) {
      const week = isoWeekLabel(new Date(c.completed_at));
      weekCounts.set(week, (weekCounts.get(week) ?? 0) + 1);
    }
  }
  const featuresPerWeek = Array.from(weekCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));

  return {
    feature_level: {
      completed,
      in_progress: inProgress,
      blocked,
      failed,
      avg_cycle_time_hours: avgCycleTimeHours,
      first_pass_rate: Math.round(firstPassRate * 1000) / 1000,
    },
    ai_effectiveness: {
      delegation_ratio: {
        none: Math.round(delegationRatio.none * 1000) / 1000,
        partial: Math.round(delegationRatio.partial * 1000) / 1000,
        majority: Math.round(delegationRatio.majority * 1000) / 1000,
        full: Math.round(delegationRatio.full * 1000) / 1000,
      },
      rework_ratio: Math.round(reworkRatio * 1000) / 1000,
      human_intervention_rate: Math.round(humanInterventionRate * 1000) / 1000,
    },
    quality: {
      review_pass_rate: Math.round(reviewPassRate * 1000) / 1000,
      features_per_week: featuresPerWeek,
    },
    period_days: periodDays,
    computed_at: new Date().toISOString(),
  };
}

function computeBottlenecks(cycles: FeatureCycleRecord[]): BottleneckEntry[] {
  // Group by sprint (phase = "sprint-N")
  const phaseMap = new Map<
    string,
    { durations: number[]; failCount: number; total: number }
  >();

  for (const c of cycles) {
    const phase = `sprint-${c.sprint}`;
    if (!phaseMap.has(phase)) {
      phaseMap.set(phase, { durations: [], failCount: 0, total: 0 });
    }
    const entry = phaseMap.get(phase)!;
    entry.total++;
    if (c.cycle_time_hours !== null) {
      entry.durations.push(c.cycle_time_hours);
    }
    if (c.status === "failed") {
      entry.failCount++;
    }
  }

  const bottlenecks: BottleneckEntry[] = [];
  for (const [phase, data] of phaseMap.entries()) {
    const avgDuration =
      data.durations.length > 0
        ? data.durations.reduce((s, d) => s + d, 0) / data.durations.length
        : 0;
    const failureRate = data.total > 0 ? data.failCount / data.total : 0;
    bottlenecks.push({
      phase,
      avg_duration_hours: Math.round(avgDuration * 100) / 100,
      failure_rate: Math.round(failureRate * 1000) / 1000,
      features_affected: data.total,
    });
  }

  // Sort by impact = avg_duration_hours * features_affected (descending)
  bottlenecks.sort(
    (a, b) =>
      b.avg_duration_hours * b.features_affected -
      a.avg_duration_hours * a.features_affected
  );

  return bottlenecks;
}

// GET /hub/projects/:projectId/throughput/metrics
throughputMetrics.get(
  "/hub/projects/:projectId/throughput/metrics",
  async (c) => {
    const { projectId } = c.req.param();
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const periodDays = parseInt(c.req.query("period_days") ?? "30", 10);
    const cacheKey = `${projectId}:${periodDays}`;

    const cached = metricsCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return c.json(cached.metrics);
    }

    const cycles = await loadAllCycles(projectId);
    const metrics = computeMetrics(cycles, periodDays);

    metricsCache.set(cacheKey, {
      metrics,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return c.json(metrics);
  }
);

// GET /hub/projects/:projectId/throughput/bottlenecks
throughputMetrics.get(
  "/hub/projects/:projectId/throughput/bottlenecks",
  async (c) => {
    const { projectId } = c.req.param();
    const project = await loadProject(projectId);
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }

    const cycles = await loadAllCycles(projectId);
    const bottlenecks = computeBottlenecks(cycles);

    return c.json({ bottlenecks });
  }
);

export { throughputMetrics };

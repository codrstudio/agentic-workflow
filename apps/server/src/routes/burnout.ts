import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateActivityLogBody,
  type SessionActivityLog,
  PatchGuardrailsBody,
  GUARDRAILS_DEFAULTS,
  type WorkGuardrails,
  type BurnoutIndicators,
  type RiskFactor,
} from "../schemas/burnout.js";
import { type Project } from "../schemas/project.js";

const burnout = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json")
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function activityLogsDir(slug: string): string {
  return path.join(projectDir(slug), "burnout", "activity-logs");
}

function activityLogPath(slug: string, date: string): string {
  return path.join(activityLogsDir(slug), `${date}.json`);
}

function dateFromIso(isoString: string): string {
  return isoString.slice(0, 10); // yyyy-mm-dd
}

async function loadDayLogs(
  slug: string,
  date: string
): Promise<SessionActivityLog[]> {
  try {
    return await readJSON<SessionActivityLog[]>(activityLogPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayLogs(
  slug: string,
  date: string,
  logs: SessionActivityLog[]
): Promise<void> {
  await ensureDir(activityLogsDir(slug));
  await writeJSON(activityLogPath(slug, date), logs);
}

// POST /hub/projects/:slug/burnout/activity — register activity log
burnout.post("/hub/projects/:slug/burnout/activity", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateActivityLogBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const log = parsed.data;

  // Aggregate into the day file based on ended_at date
  const date = dateFromIso(log.ended_at);
  const dayLogs = await loadDayLogs(slug, date);
  dayLogs.push(log);
  await saveDayLogs(slug, date, dayLogs);

  return c.json(log, 201);
});

// --- Indicators ---

async function listActivityLogFiles(slug: string): Promise<string[]> {
  const dir = activityLogsDir(slug);
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }
}

async function loadLogsForPeriod(
  slug: string,
  periodDays: number
): Promise<SessionActivityLog[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const files = await listActivityLogFiles(slug);
  const relevantFiles = files.filter((f) => f.replace(".json", "") >= cutoffDate);

  const allLogs: SessionActivityLog[] = [];
  for (const file of relevantFiles) {
    const date = file.replace(".json", "");
    const dayLogs = await loadDayLogs(slug, date);
    // Filter individual logs by cutoff datetime
    for (const log of dayLogs) {
      if (new Date(log.ended_at) >= cutoff) {
        allLogs.push(log);
      }
    }
  }
  return allLogs;
}

function isWeekend(dateStr: string): boolean {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function computeLongestStreak(logs: SessionActivityLog[]): number {
  if (logs.length === 0) return 0;

  // Get unique dates with sessions
  const datesSet = new Set<string>();
  for (const log of logs) {
    datesSet.add(log.ended_at.slice(0, 10));
  }
  const dates = [...datesSet].sort();
  if (dates.length === 0) return 0;

  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1]!);
    const curr = new Date(dates[i]!);
    const diffMs = curr.getTime() - prev.getTime();
    const diffDays = diffMs / (24 * 60 * 60 * 1000);

    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else {
      currentStreak = 1;
    }
  }
  return maxStreak;
}

function computeMaxDailyMinutes(logs: SessionActivityLog[]): number {
  const dailyMinutes = new Map<string, number>();
  for (const log of logs) {
    const date = log.ended_at.slice(0, 10);
    dailyMinutes.set(date, (dailyMinutes.get(date) ?? 0) + log.duration_minutes);
  }
  let max = 0;
  for (const mins of dailyMinutes.values()) {
    if (mins > max) max = mins;
  }
  return max;
}

function computeIndicators(
  projectId: string,
  logs: SessionActivityLog[],
  periodDays: number,
  guardrails: WorkGuardrails
): BurnoutIndicators {
  const sessionsCount = logs.length;

  // Intensity metrics
  const totalActiveMinutes = logs.reduce((s, l) => s + l.duration_minutes, 0);
  const avgSessionDuration = sessionsCount > 0 ? totalActiveMinutes / sessionsCount : 0;
  const totalMessages = logs.reduce((s, l) => s + l.message_count, 0);
  const avgMessages = sessionsCount > 0 ? totalMessages / sessionsCount : 0;

  // Pattern metrics
  const longestStreak = computeLongestStreak(logs);
  const lateHour = guardrails.late_hour_threshold;
  const lateSessions = logs.filter((l) => {
    const hour = new Date(l.started_at).getUTCHours();
    return hour >= lateHour;
  }).length;
  const weekendSessions = logs.filter((l) => isWeekend(l.started_at)).length;
  const totalContextSwitches = logs.reduce((s, l) => s + l.context_switches, 0);
  const avgContextSwitches = sessionsCount > 0 ? totalContextSwitches / sessionsCount : 0;

  // Verification metrics
  const reviewMinutes = logs
    .filter((l) => l.phase === "review")
    .reduce((s, l) => s + l.duration_minutes, 0);
  const generationMinutes = logs
    .filter((l) => l.phase !== "review")
    .reduce((s, l) => s + l.duration_minutes, 0);
  const reviewToGenRatio =
    generationMinutes > 0 ? reviewMinutes / generationMinutes : 0;

  // Max session duration in the period (in minutes)
  const maxSessionDuration = logs.reduce(
    (max, l) => (l.duration_minutes > max ? l.duration_minutes : max),
    0
  );

  // Max daily active minutes
  const maxDailyMinutes = computeMaxDailyMinutes(logs);

  // Risk factors (7 factors from S-016 section 5.1)
  const riskFactors: RiskFactor[] = [
    {
      factor: "long_session",
      description: "Sessao longa (> 3h no periodo)",
      current_value: Math.round(maxSessionDuration),
      threshold: 180,
      triggered: maxSessionDuration > 180,
    },
    {
      factor: "intense_day",
      description: "Dia intenso (> 10h ativas)",
      current_value: Math.round(maxDailyMinutes),
      threshold: 600,
      triggered: maxDailyMinutes > 600,
    },
    {
      factor: "long_streak",
      description: "Streak longo (> 5 dias consecutivos)",
      current_value: longestStreak,
      threshold: 5,
      triggered: longestStreak > 5,
    },
    {
      factor: "late_sessions",
      description: `Sessoes tardias (> 3 apos ${lateHour}h)`,
      current_value: lateSessions,
      threshold: 3,
      triggered: lateSessions > 3,
    },
    {
      factor: "weekend_sessions",
      description: "Sessoes em fim de semana (> 2)",
      current_value: weekendSessions,
      threshold: 2,
      triggered: weekendSessions > 2,
    },
    {
      factor: "context_switching",
      description: `Trocas de contexto (media > ${guardrails.context_switch_warning_threshold}/sessao)`,
      current_value: Math.round(avgContextSwitches * 100) / 100,
      threshold: guardrails.context_switch_warning_threshold,
      triggered: avgContextSwitches > guardrails.context_switch_warning_threshold,
    },
    {
      factor: "verification_tax",
      description: "Verification tax alta (review/generation ratio > 1.5)",
      current_value: Math.round(reviewToGenRatio * 100) / 100,
      threshold: 1.5,
      triggered: reviewToGenRatio > 1.5,
    },
  ];

  const triggeredCount = riskFactors.filter((f) => f.triggered).length;
  const riskLevel =
    triggeredCount >= 3
      ? "critical" as const
      : triggeredCount >= 2
        ? "high" as const
        : triggeredCount >= 1
          ? "moderate" as const
          : "low" as const;

  return {
    project_id: projectId,
    computed_at: new Date().toISOString(),
    period_days: periodDays,
    avg_session_duration_minutes: Math.round(avgSessionDuration * 100) / 100,
    total_active_minutes_period: Math.round(totalActiveMinutes * 100) / 100,
    sessions_count_period: sessionsCount,
    avg_messages_per_session: Math.round(avgMessages * 100) / 100,
    longest_streak_days: longestStreak,
    late_sessions_count: lateSessions,
    weekend_sessions_count: weekendSessions,
    avg_context_switches_per_session: Math.round(avgContextSwitches * 100) / 100,
    review_to_generation_ratio: Math.round(reviewToGenRatio * 100) / 100,
    verification_minutes_period: Math.round(reviewMinutes * 100) / 100,
    risk_level: riskLevel,
    risk_factors: riskFactors,
  };
}

// GET /hub/projects/:slug/burnout/indicators — get computed burnout indicators
burnout.get("/hub/projects/:slug/burnout/indicators", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const periodDaysParam = c.req.query("period_days");
  const periodDays = periodDaysParam ? parseInt(periodDaysParam, 10) : 7;
  if (isNaN(periodDays) || periodDays < 1) {
    return c.json({ error: "period_days must be a positive integer" }, 400);
  }

  const logs = await loadLogsForPeriod(slug, periodDays);
  const guardrails = await loadGuardrails(slug);
  const indicators = computeIndicators(project.id, logs, periodDays, guardrails);

  return c.json(indicators);
});

// GET /hub/projects/:slug/burnout/activity-summary — daily activity breakdown by phase
burnout.get("/hub/projects/:slug/burnout/activity-summary", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const periodDaysParam = c.req.query("period_days");
  const periodDays = periodDaysParam ? parseInt(periodDaysParam, 10) : 7;
  if (isNaN(periodDays) || periodDays < 1) {
    return c.json({ error: "period_days must be a positive integer" }, 400);
  }

  const logs = await loadLogsForPeriod(slug, periodDays);

  // Group by date and phase
  const dailyMap = new Map<string, Record<string, number>>();
  for (const log of logs) {
    const date = log.ended_at.slice(0, 10);
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {});
    }
    const dayEntry = dailyMap.get(date)!;
    dayEntry[log.phase] = (dayEntry[log.phase] ?? 0) + log.duration_minutes;
  }

  // Build sorted array of daily summaries
  const days = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, phases]) => ({ date, ...phases }));

  return c.json({ period_days: periodDays, days });
});

// --- Guardrails ---

function guardrailsPath(slug: string): string {
  return path.join(projectDir(slug), "burnout", "guardrails.json");
}

async function loadGuardrails(slug: string): Promise<WorkGuardrails> {
  try {
    const saved = await readJSON<Partial<WorkGuardrails>>(guardrailsPath(slug));
    return { ...GUARDRAILS_DEFAULTS, ...saved };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return { ...GUARDRAILS_DEFAULTS };
    throw err;
  }
}

// GET /hub/projects/:slug/burnout/guardrails — get guardrails (returns defaults if none saved)
burnout.get("/hub/projects/:slug/burnout/guardrails", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const guardrails = await loadGuardrails(slug);
  return c.json(guardrails);
});

// PATCH /hub/projects/:slug/burnout/guardrails — update guardrails
burnout.patch("/hub/projects/:slug/burnout/guardrails", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchGuardrailsBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const current = await loadGuardrails(slug);
  const updated: WorkGuardrails = { ...current, ...parsed.data };

  await ensureDir(path.join(projectDir(slug), "burnout"));
  await writeJSON(guardrailsPath(slug), updated);

  return c.json(updated);
});

export { burnout };

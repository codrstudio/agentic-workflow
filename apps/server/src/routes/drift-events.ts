import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  DriftEventSchema,
  CreateDriftEventBody,
  type DriftEvent,
  type DriftType,
  type ContainmentSummary,
} from "../schemas/drift-event.js";
import { type ContainmentPolicy } from "../schemas/containment-policy.js";
import { type Project } from "../schemas/project.js";

const driftEvents = new Hono();

// In-memory summary cache: projectSlug -> { summary, expiresAt }
const summaryCache = new Map<string, { summary: ContainmentSummary; expiresAt: number }>();
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

function driftEventsDirPath(slug: string): string {
  return path.join(projectDir(slug), "drift-events");
}

function dateKey(isoDate: string): string {
  return isoDate.slice(0, 10); // yyyy-mm-dd
}

function driftEventsFilePath(slug: string, date: string): string {
  return path.join(driftEventsDirPath(slug), `${date}.json`);
}

async function loadAllDriftEvents(slug: string): Promise<DriftEvent[]> {
  const dir = driftEventsDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const events: DriftEvent[] = [];
  for (const file of files) {
    try {
      const data = await readJSON<DriftEvent[]>(path.join(dir, file));
      if (Array.isArray(data)) {
        events.push(...data);
      }
    } catch {
      // skip malformed files
    }
  }
  return events;
}

async function appendDriftEvent(slug: string, event: DriftEvent): Promise<void> {
  const date = dateKey(event.detected_at);
  const filePath = driftEventsFilePath(slug, date);
  await ensureDir(driftEventsDirPath(slug));

  let existing: DriftEvent[] = [];
  try {
    const data = await readJSON<DriftEvent[]>(filePath);
    if (Array.isArray(data)) existing = data;
  } catch {
    // file doesn't exist yet — start fresh
  }

  existing.push(event);
  await writeJSON(filePath, existing);
}

async function loadPolicies(slug: string): Promise<ContainmentPolicy[]> {
  const policiesDir = path.join(projectDir(slug), "containment-policies");
  let files: string[];
  try {
    const entries = await readdir(policiesDir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch {
    return [];
  }

  const policies: ContainmentPolicy[] = [];
  for (const file of files) {
    try {
      const p = await readJSON<ContainmentPolicy>(path.join(policiesDir, file));
      policies.push(p);
    } catch {
      // skip malformed
    }
  }
  return policies;
}

function computeSummary(
  events: DriftEvent[],
  policies: ContainmentPolicy[],
  periodDays: number
): ContainmentSummary {
  const driftTypes: DriftType[] = [
    "path_violation",
    "tool_violation",
    "timeout_warning",
    "output_exceeded",
    "off_topic",
  ];

  // drift_by_type counts
  const driftByType: Record<DriftType, number> = {
    path_violation: 0,
    tool_violation: 0,
    timeout_warning: 0,
    output_exceeded: 0,
    off_topic: 0,
  };
  for (const e of events) {
    driftByType[e.drift_type] = (driftByType[e.drift_type] ?? 0) + 1;
  }

  // spawns_with_drift: unique (step ?? agent ?? id) spawn identifiers
  const spawnKeys = new Set<string>();
  for (const e of events) {
    const key = e.step ?? e.agent ?? e.id;
    spawnKeys.add(key);
  }
  const spawnsWithDrift = spawnKeys.size;

  // policies_active
  const policiesActive = policies.filter((p) => p.enabled).length;

  // most_violated_policy: policy_name that appears most often
  const policyCounts = new Map<string, number>();
  for (const e of events) {
    policyCounts.set(e.policy_name, (policyCounts.get(e.policy_name) ?? 0) + 1);
  }
  let mostViolatedPolicy: string | null = null;
  let maxCount = 0;
  for (const [name, count] of policyCounts) {
    if (count > maxCount) {
      maxCount = count;
      mostViolatedPolicy = name;
    }
  }

  // interventions: action_taken = 'intervened' or 'killed'
  const interventions = events.filter(
    (e) => e.action_taken === "intervened" || e.action_taken === "killed"
  ).length;

  // total_spawns approximation: we use spawns_with_drift as minimum
  // If there are policies but few events, still set total_spawns = spawnsWithDrift
  const totalSpawns = spawnsWithDrift;
  const driftRate = totalSpawns > 0 ? spawnsWithDrift / totalSpawns : 0;

  return {
    total_spawns: totalSpawns,
    spawns_with_drift: spawnsWithDrift,
    drift_rate: driftRate,
    drift_by_type: driftByType,
    policies_active: policiesActive,
    most_violated_policy: mostViolatedPolicy,
    interventions,
    period_days: periodDays,
  };
}

// GET /hub/projects/:slug/containment/drift-events
driftEvents.get("/hub/projects/:slug/containment/drift-events", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let events = await loadAllDriftEvents(slug);

  const driftTypeFilter = c.req.query("drift_type");
  const stepFilter = c.req.query("step");
  const fromFilter = c.req.query("from");
  const toFilter = c.req.query("to");
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 100;

  if (driftTypeFilter) {
    events = events.filter((e) => e.drift_type === driftTypeFilter);
  }
  if (stepFilter) {
    events = events.filter((e) => e.step === stepFilter);
  }
  if (fromFilter) {
    const from = new Date(fromFilter).getTime();
    events = events.filter((e) => new Date(e.detected_at).getTime() >= from);
  }
  if (toFilter) {
    // inclusive: end of the to day
    const toDate = new Date(toFilter);
    toDate.setUTCHours(23, 59, 59, 999);
    const to = toDate.getTime();
    events = events.filter((e) => new Date(e.detected_at).getTime() <= to);
  }

  // Sort by detected_at desc
  events.sort((a, b) => b.detected_at.localeCompare(a.detected_at));

  return c.json(events.slice(0, limit));
});

// POST /hub/projects/:slug/containment/drift-events
driftEvents.post("/hub/projects/:slug/containment/drift-events", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateDriftEventBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const data = parsed.data;
  const id = randomUUID();
  const detectedAt = data.detected_at ?? new Date().toISOString();

  const event: DriftEvent = {
    id,
    project_id: project.id,
    policy_id: data.policy_id,
    policy_name: data.policy_name,
    drift_type: data.drift_type,
    description: data.description,
    step: data.step ?? null,
    agent: data.agent ?? null,
    action_taken: data.action_taken,
    detected_at: detectedAt,
  };

  const validated = DriftEventSchema.safeParse(event);
  if (!validated.success) {
    return c.json({ error: "Event construction failed", details: validated.error.issues }, 500);
  }

  await appendDriftEvent(slug, validated.data);

  // Invalidate cache
  summaryCache.delete(slug);

  return c.json(validated.data, 201);
});

// GET /hub/projects/:slug/containment/summary
driftEvents.get("/hub/projects/:slug/containment/summary", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Check cache
  const cached = summaryCache.get(slug);
  if (cached && Date.now() < cached.expiresAt) {
    return c.json(cached.summary);
  }

  const events = await loadAllDriftEvents(slug);
  const policies = await loadPolicies(slug);

  // Determine period_days from event range or default 30
  let periodDays = 30;
  if (events.length > 0) {
    const sorted = events.map((e) => new Date(e.detected_at).getTime()).sort((a, b) => a - b);
    const earliest = sorted[0]!;
    const latest = sorted[sorted.length - 1]!;
    const diffMs = latest - earliest;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    periodDays = Math.max(1, diffDays);
  }

  const summary = computeSummary(events, policies, periodDays);

  summaryCache.set(slug, { summary, expiresAt: Date.now() + CACHE_TTL_MS });

  return c.json(summary);
});

export { driftEvents };

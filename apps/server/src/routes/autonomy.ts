import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  PatchPhaseAutonomyBody,
  PHASE_DEFAULTS,
  ALL_PHASES,
  type PhaseAutonomyConfig,
  type PipelinePhase,
} from "../schemas/phase-autonomy.js";
import {
  CreateDelegationEventBody,
  type DelegationEvent,
} from "../schemas/delegation-event.js";
import { type Project } from "../schemas/project.js";
import {
  type TrustProgression,
  type PhaseDelegationRate,
  type TrustTrend,
} from "../schemas/trust-progression.js";

const autonomy = new Hono();

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

function phaseConfigPath(slug: string, phase: string): string {
  return path.join(
    projectDir(slug),
    "autonomy",
    "phase-configs",
    `${phase}.json`
  );
}

async function loadPhaseConfig(
  slug: string,
  phase: PipelinePhase
): Promise<PhaseAutonomyConfig> {
  try {
    return await readJSON<PhaseAutonomyConfig>(phaseConfigPath(slug, phase));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      const defaults = PHASE_DEFAULTS[phase];
      return { ...defaults, updated_at: new Date().toISOString() };
    }
    throw err;
  }
}

async function savePhaseConfig(
  slug: string,
  config: PhaseAutonomyConfig
): Promise<void> {
  await writeJSON(phaseConfigPath(slug, config.phase), config);
}

// GET /hub/projects/:slug/autonomy/phases — get all 6 phase configs
autonomy.get("/hub/projects/:slug/autonomy/phases", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const phases = await Promise.all(
    ALL_PHASES.map((phase) => loadPhaseConfig(slug, phase))
  );

  return c.json({ phases });
});

// PATCH /hub/projects/:slug/autonomy/phases — update a single phase config
autonomy.patch("/hub/projects/:slug/autonomy/phases", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchPhaseAutonomyBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { phase, ...updates } = parsed.data;
  const current = await loadPhaseConfig(slug, phase);
  const updated: PhaseAutonomyConfig = {
    ...current,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await savePhaseConfig(slug, updated);

  return c.json(updated);
});

// --- Delegation Events (F-122) ---

function delegationEventsDir(slug: string): string {
  return path.join(projectDir(slug), "autonomy", "delegation-events");
}

function delegationEventsDayPath(slug: string, date: string): string {
  return path.join(delegationEventsDir(slug), `${date}.json`);
}

async function loadDayEvents(
  slug: string,
  date: string
): Promise<DelegationEvent[]> {
  try {
    return await readJSON<DelegationEvent[]>(
      delegationEventsDayPath(slug, date)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayEvents(
  slug: string,
  date: string,
  events: DelegationEvent[]
): Promise<void> {
  await writeJSON(delegationEventsDayPath(slug, date), events);
}

async function loadAllEvents(slug: string): Promise<DelegationEvent[]> {
  const dir = delegationEventsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: DelegationEvent[] = [];
  for (const file of files) {
    const date = file.replace(".json", "");
    const events = await loadDayEvents(slug, date);
    all.push(...events);
  }
  return all;
}

// POST /hub/projects/:slug/autonomy/events — register a delegation event
autonomy.post("/hub/projects/:slug/autonomy/events", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateDelegationEventBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date();
  const event: DelegationEvent = {
    id: crypto.randomUUID(),
    project_id: slug,
    phase: parsed.data.phase,
    event_type: parsed.data.event_type,
    agent_confidence: parsed.data.agent_confidence,
    details: parsed.data.details,
    created_at: now.toISOString(),
  };

  const dateKey = now.toISOString().slice(0, 10); // yyyy-mm-dd
  const dayEvents = await loadDayEvents(slug, dateKey);
  dayEvents.push(event);
  await saveDayEvents(slug, dateKey, dayEvents);

  return c.json(event, 201);
});

// GET /hub/projects/:slug/autonomy/events — list delegation events with filters
autonomy.get("/hub/projects/:slug/autonomy/events", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const phaseFilter = c.req.query("phase");
  const eventTypeFilter = c.req.query("event_type");
  const fromFilter = c.req.query("from");
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  let events = await loadAllEvents(slug);

  // Filter by phase
  if (phaseFilter) {
    events = events.filter((e) => e.phase === phaseFilter);
  }

  // Filter by event_type
  if (eventTypeFilter) {
    events = events.filter((e) => e.event_type === eventTypeFilter);
  }

  // Filter by from (date)
  if (fromFilter) {
    events = events.filter((e) => e.created_at >= fromFilter);
  }

  // Sort by created_at descending (newest first)
  events.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Apply limit
  events = events.slice(0, limit);

  return c.json({ events });
});

// --- Trust Progression (F-123) ---

function trustProgressionPath(slug: string): string {
  return path.join(projectDir(slug), "autonomy", "trust-progression.json");
}

function filterEventsByPeriod(
  events: DelegationEvent[],
  periodDays: number,
  referenceDate: Date = new Date()
): DelegationEvent[] {
  const cutoff = new Date(referenceDate);
  cutoff.setDate(cutoff.getDate() - periodDays);
  return events.filter((e) => new Date(e.created_at) >= cutoff);
}

function computeTrustScore(events: DelegationEvent[]): {
  trust_score: number;
  delegation_rate: number;
  success_rate_auto: number;
  escalation_rate: number;
} {
  const total = events.length;
  if (total === 0) {
    return {
      trust_score: 0,
      delegation_rate: 0,
      success_rate_auto: 0,
      escalation_rate: 0,
    };
  }

  const autoExecuted = events.filter((e) => e.event_type === "auto_executed");
  const escalated = events.filter((e) => e.event_type === "escalated");

  const delegation_rate = autoExecuted.length / total;
  const escalation_rate = escalated.length / total;

  // success_rate_auto: auto_executed that didn't result in escalation
  // We consider auto_executed events successful if agent_confidence >= threshold (proxy: >= 0.5)
  // Since we don't track "defects" directly, we use auto_executed with confidence >= 0.5 as successful
  // Per PRP: "auto sem defeito / auto total"
  // We approximate: auto_executed events that are NOT followed by escalation in same phase within same day
  let successfulAuto = autoExecuted.length;
  if (autoExecuted.length > 0) {
    // Count auto_executed events where the phase doesn't have a corresponding escalation
    const escalatedPhases = new Set(escalated.map((e) => `${e.phase}-${e.created_at.slice(0, 10)}`));
    const failedAuto = autoExecuted.filter((e) =>
      escalatedPhases.has(`${e.phase}-${e.created_at.slice(0, 10)}`)
    ).length;
    successfulAuto = autoExecuted.length - failedAuto;
  }

  const success_rate_auto =
    autoExecuted.length > 0 ? successfulAuto / autoExecuted.length : 0;

  const trust_score = Math.min(
    100,
    Math.max(
      0,
      Math.round(
        delegation_rate * 40 +
          success_rate_auto * 40 +
          (1 - escalation_rate) * 20
      )
    )
  );

  return { trust_score, delegation_rate, success_rate_auto, escalation_rate };
}

function computePhaseDelegationRates(
  events: DelegationEvent[]
): PhaseDelegationRate[] {
  return ALL_PHASES.map((phase) => {
    const phaseEvents = events.filter((e) => e.phase === phase);
    const autoExecuted = phaseEvents.filter(
      (e) => e.event_type === "auto_executed"
    ).length;
    return {
      phase,
      delegation_rate: phaseEvents.length > 0 ? autoExecuted / phaseEvents.length : 0,
      total_events: phaseEvents.length,
      auto_executed: autoExecuted,
    };
  });
}

function computeTrend(
  currentScore: number,
  previousScore: number | null
): TrustTrend {
  if (previousScore === null) return "stable";
  const delta = currentScore - previousScore;
  if (delta > 5) return "rising";
  if (delta < -5) return "declining";
  return "stable";
}

// GET /hub/projects/:slug/autonomy/trust — compute trust progression
autonomy.get("/hub/projects/:slug/autonomy/trust", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const periodDaysParam = c.req.query("period_days");
  const periodDays = periodDaysParam ? parseInt(periodDaysParam, 10) : 30;

  if (isNaN(periodDays) || periodDays < 1) {
    return c.json({ error: "period_days must be a positive integer" }, 400);
  }

  const allEvents = await loadAllEvents(slug);
  const now = new Date();

  // Current period events
  const currentEvents = filterEventsByPeriod(allEvents, periodDays, now);

  // Previous period events (for trend comparison)
  const previousEnd = new Date(now);
  previousEnd.setDate(previousEnd.getDate() - periodDays);
  const previousEvents = filterEventsByPeriod(allEvents, periodDays, previousEnd);

  const current = computeTrustScore(currentEvents);
  const previous = previousEvents.length > 0 ? computeTrustScore(previousEvents) : null;
  const previousScore = previous ? previous.trust_score : null;

  const trend = computeTrend(current.trust_score, previousScore);
  const phaseDelegationRates = computePhaseDelegationRates(currentEvents);

  const result: TrustProgression = {
    project_id: slug,
    trust_score: current.trust_score,
    delegation_rate: current.delegation_rate,
    success_rate_auto: current.success_rate_auto,
    escalation_rate: current.escalation_rate,
    trend,
    previous_score: previousScore,
    period_days: periodDays,
    total_events: currentEvents.length,
    phase_delegation_rates: phaseDelegationRates,
    computed_at: now.toISOString(),
  };

  // Persist computed result
  await writeJSON(trustProgressionPath(slug), result);

  return c.json(result);
});

export { autonomy };

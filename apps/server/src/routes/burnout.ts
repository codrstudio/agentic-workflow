import { Hono } from "hono";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateActivityLogBody,
  type SessionActivityLog,
  PatchGuardrailsBody,
  GUARDRAILS_DEFAULTS,
  type WorkGuardrails,
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

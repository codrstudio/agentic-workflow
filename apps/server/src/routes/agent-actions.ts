import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  AgentActionSchema,
  CreateAgentActionBody,
  PatchAgentActionBody,
  ApproveAgentActionBody,
  MorningReportConfigSchema,
  PatchMorningReportConfigBody,
  type AgentAction,
  type MorningReportConfig,
} from "../schemas/agent-action.js";
import { type Project } from "../schemas/project.js";

const agentActions = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function agentActionsDir(slug: string): string {
  return path.join(projectDir(slug), "agent-actions");
}

function agentActionsDayPath(slug: string, date: string): string {
  return path.join(agentActionsDir(slug), `${date}.json`);
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

async function loadDayActions(slug: string, date: string): Promise<AgentAction[]> {
  try {
    return await readJSON<AgentAction[]>(agentActionsDayPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayActions(slug: string, date: string, actions: AgentAction[]): Promise<void> {
  await ensureDir(agentActionsDir(slug));
  await writeJSON(agentActionsDayPath(slug, date), actions);
}

async function loadAllActions(slug: string): Promise<AgentAction[]> {
  const dir = agentActionsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: AgentAction[] = [];
  for (const file of files) {
    try {
      const dayActions = await readJSON<AgentAction[]>(path.join(dir, file));
      if (Array.isArray(dayActions)) all.push(...dayActions);
    } catch {
      // skip malformed files
    }
  }
  return all;
}

// Find an action by ID across all day files, returning action + its date key
async function findActionById(
  slug: string,
  actionId: string
): Promise<{ action: AgentAction; dateKey: string } | null> {
  const dir = agentActionsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort().reverse();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return null;
    throw err;
  }
  for (const file of files) {
    try {
      const dayActions = await readJSON<AgentAction[]>(path.join(dir, file));
      if (!Array.isArray(dayActions)) continue;
      const found = dayActions.find((a) => a.id === actionId);
      if (found) {
        return { action: found, dateKey: file.replace(".json", "") };
      }
    } catch {
      // skip malformed files
    }
  }
  return null;
}

function truncatePreview(value: string | null | undefined): string | null | undefined {
  if (typeof value === "string" && value.length > 500) {
    return value.slice(0, 500);
  }
  return value;
}

// --- Morning report config helpers ---

function morningReportConfigPath(slug: string): string {
  return path.join(projectDir(slug), "morning-report-config.json");
}

async function loadMorningReportConfig(slug: string): Promise<MorningReportConfig> {
  try {
    return await readJSON<MorningReportConfig>(morningReportConfigPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return {
        project_id: slug,
        enabled: true,
        lookback_hours: 12,
        include_types: ["feature_spawn", "review_spawn", "merge_spawn", "automation"],
        notify_on_session_start: true,
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

// --- Routes ---

// GET /hub/projects/:slug/agent-actions — list with filters
agentActions.get("/hub/projects/:slug/agent-actions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const from = c.req.query("from");
  const to = c.req.query("to");
  const status = c.req.query("status");
  const actionType = c.req.query("action_type");
  const featureId = c.req.query("feature_id");
  const limitStr = c.req.query("limit");
  const limit = limitStr ? Math.min(Math.max(parseInt(limitStr, 10) || 100, 1), 1000) : 100;

  // Load actions from relevant day files
  const dir = agentActionsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return c.json([]);
    throw err;
  }

  // Filter day files by date range if provided (optimization)
  if (from) {
    const fromDate = from.slice(0, 10);
    files = files.filter((f) => f.replace(".json", "") >= fromDate);
  }
  if (to) {
    const toDate = to.slice(0, 10);
    files = files.filter((f) => f.replace(".json", "") <= toDate);
  }

  let allActions: AgentAction[] = [];
  for (const file of files) {
    try {
      const dayActions = await readJSON<AgentAction[]>(path.join(dir, file));
      if (Array.isArray(dayActions)) allActions.push(...dayActions);
    } catch {
      // skip malformed files
    }
  }

  // Apply filters
  if (from) {
    allActions = allActions.filter((a) => a.started_at >= from);
  }
  if (to) {
    allActions = allActions.filter((a) => a.started_at <= to);
  }
  if (status) {
    allActions = allActions.filter((a) => a.status === status);
  }
  if (actionType) {
    allActions = allActions.filter((a) => a.action_type === actionType);
  }
  if (featureId) {
    allActions = allActions.filter((a) => a.feature_id === featureId);
  }

  // Sort by started_at descending
  allActions.sort((a, b) => b.started_at.localeCompare(a.started_at));

  // Apply limit
  return c.json(allActions.slice(0, limit));
});

// POST /hub/projects/:slug/agent-actions — create with status=running
agentActions.post("/hub/projects/:slug/agent-actions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateAgentActionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const now = new Date();
  const startedAt = data.started_at ?? now.toISOString();

  const action: AgentAction = {
    id: randomUUID(),
    project_id: slug,
    action_type: data.action_type,
    status: "running",
    agent_profile: data.agent_profile,
    task_name: data.task_name,
    feature_id: data.feature_id ?? null,
    started_at: startedAt,
    completed_at: null,
    duration_ms: null,
    exit_code: null,
    summary: data.summary ?? null,
    output_preview: truncatePreview(data.output_preview) ?? null,
    requires_approval: data.requires_approval,
    approval_reason: data.approval_reason ?? null,
    approved_by: null,
    approval_note: null,
    approved_at: null,
    spawn_dir: data.spawn_dir ?? null,
  };

  const dateKey = startedAt.slice(0, 10);
  const dayActions = await loadDayActions(slug, dateKey);
  dayActions.push(action);
  await saveDayActions(slug, dateKey, dayActions);

  return c.json(action, 201);
});

// PATCH /hub/projects/:slug/agent-actions/:actionId — update status/completion fields
agentActions.patch("/hub/projects/:slug/agent-actions/:actionId", async (c) => {
  const slug = c.req.param("slug");
  const actionId = c.req.param("actionId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchAgentActionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const found = await findActionById(slug, actionId);
  if (!found) return c.json({ error: "AgentAction not found" }, 404);

  const { action, dateKey } = found;
  const patch = parsed.data;

  const updated: AgentAction = {
    ...action,
    ...(patch.status !== undefined && { status: patch.status }),
    ...(patch.completed_at !== undefined && { completed_at: patch.completed_at }),
    ...(patch.duration_ms !== undefined && { duration_ms: patch.duration_ms }),
    ...(patch.exit_code !== undefined && { exit_code: patch.exit_code }),
    ...(patch.summary !== undefined && { summary: patch.summary }),
    ...(patch.output_preview !== undefined && {
      output_preview: truncatePreview(patch.output_preview) ?? null,
    }),
  };

  // Validate the final shape
  const validated = AgentActionSchema.safeParse(updated);
  if (!validated.success) {
    return c.json({ error: "Internal validation failed", details: validated.error.flatten() }, 500);
  }

  const dayActions = await loadDayActions(slug, dateKey);
  const idx = dayActions.findIndex((a) => a.id === actionId);
  if (idx === -1) {
    dayActions.push(validated.data);
  } else {
    dayActions[idx] = validated.data;
  }
  await saveDayActions(slug, dateKey, dayActions);

  return c.json(validated.data);
});

// POST /hub/projects/:slug/agent-actions/:actionId/approve — approve or reject
agentActions.post("/hub/projects/:slug/agent-actions/:actionId/approve", async (c) => {
  const slug = c.req.param("slug");
  const actionId = c.req.param("actionId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = ApproveAgentActionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const found = await findActionById(slug, actionId);
  if (!found) return c.json({ error: "AgentAction not found" }, 404);

  const { action, dateKey } = found;
  const now = new Date().toISOString();

  const updated: AgentAction = {
    ...action,
    status: parsed.data.decision,
    approved_at: now,
    approved_by: "user",
    approval_note: parsed.data.note ?? null,
  };

  const validated = AgentActionSchema.safeParse(updated);
  if (!validated.success) {
    return c.json({ error: "Internal validation failed", details: validated.error.flatten() }, 500);
  }

  const dayActions = await loadDayActions(slug, dateKey);
  const idx = dayActions.findIndex((a) => a.id === actionId);
  if (idx === -1) {
    dayActions.push(validated.data);
  } else {
    dayActions[idx] = validated.data;
  }
  await saveDayActions(slug, dateKey, dayActions);

  return c.json(validated.data);
});

// GET /hub/projects/:slug/morning-report — computed morning report
agentActions.get("/hub/projects/:slug/morning-report", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const cfg = await loadMorningReportConfig(slug);

  const now = new Date();
  const periodTo = now.toISOString();
  const periodFrom = new Date(now.getTime() - cfg.lookback_hours * 60 * 60 * 1000).toISOString();

  // Load all actions and filter by period + types
  const allActions = await loadAllActions(slug);
  const includeTypes = new Set(cfg.include_types);

  const filtered = allActions.filter((a) =>
    a.started_at >= periodFrom &&
    a.started_at <= periodTo &&
    includeTypes.has(a.action_type)
  );

  // Sort by started_at desc
  filtered.sort((a, b) => b.started_at.localeCompare(a.started_at));

  const summary = {
    total: filtered.length,
    completed: filtered.filter((a) => a.status === "completed").length,
    failed: filtered.filter((a) => a.status === "failed").length,
    pending_approval: filtered.filter((a) => a.status === "pending_approval").length,
    skipped: filtered.filter((a) => a.status === "skipped").length,
  };

  return c.json({
    project_id: slug,
    generated_at: now.toISOString(),
    period_from: periodFrom,
    period_to: periodTo,
    actions: filtered,
    summary,
    has_pending_approvals: summary.pending_approval > 0,
  });
});

// GET /hub/projects/:slug/morning-report/config — get morning report config
agentActions.get("/hub/projects/:slug/morning-report/config", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const cfg = await loadMorningReportConfig(slug);
  return c.json(cfg);
});

// PATCH /hub/projects/:slug/morning-report/config — update morning report config
agentActions.patch("/hub/projects/:slug/morning-report/config", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchMorningReportConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 400);
  }

  const existing = await loadMorningReportConfig(slug);
  const updated: MorningReportConfig = {
    ...existing,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  await ensureDir(projectDir(slug));
  await writeJSON(morningReportConfigPath(slug), updated);

  return c.json(updated);
});

export { agentActions };

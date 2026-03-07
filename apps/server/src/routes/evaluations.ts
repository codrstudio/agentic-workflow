import { Hono } from "hono";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateAgentEvaluationBody,
  PatchAgentEvaluationBody,
  type AgentEvaluation,
} from "../schemas/agent-evaluation.js";
import { type Project } from "../schemas/project.js";

const evaluations = new Hono();

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

function recordsDir(slug: string): string {
  return path.join(projectDir(slug), "evaluations", "records");
}

function recordPath(slug: string, id: string): string {
  return path.join(recordsDir(slug), `${id}.json`);
}

async function loadRecord(
  slug: string,
  id: string
): Promise<AgentEvaluation | null> {
  try {
    return await readJSON<AgentEvaluation>(recordPath(slug, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveRecord(
  slug: string,
  id: string,
  record: AgentEvaluation
): Promise<void> {
  await writeJSON(recordPath(slug, id), record);
}

async function loadAllRecords(slug: string): Promise<AgentEvaluation[]> {
  const dir = recordsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const records: AgentEvaluation[] = [];
  for (const file of files) {
    const id = file.replace(".json", "");
    const record = await loadRecord(slug, id);
    if (record) records.push(record);
  }
  return records;
}

// POST /hub/projects/:slug/evaluations — create evaluation
evaluations.post("/hub/projects/:slug/evaluations", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateAgentEvaluationBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const record: AgentEvaluation = {
    id,
    project_id: slug,
    agent_profile: parsed.data.agent_profile,
    agent_model: parsed.data.agent_model,
    task_type: parsed.data.task_type,
    wave_number: parsed.data.wave_number,
    step_name: parsed.data.step_name,
    feature_id: parsed.data.feature_id,
    attempt_number: parsed.data.attempt_number ?? 1,
    exit_code: parsed.data.exit_code,
    success: parsed.data.success,
    duration_seconds: parsed.data.duration_seconds,
    tokens_used: parsed.data.tokens_used ?? 0,
    cost_usd: parsed.data.cost_usd ?? 0,
    quality_score: parsed.data.quality_score,
    quality_factors: parsed.data.quality_factors,
    spawn_json_path: parsed.data.spawn_json_path,
    created_at: now,
  };

  await saveRecord(slug, id, record);
  return c.json(record, 201);
});

// PATCH /hub/projects/:slug/evaluations/:evaluationId — update quality score
evaluations.patch(
  "/hub/projects/:slug/evaluations/:evaluationId",
  async (c) => {
    const slug = c.req.param("slug");
    const evaluationId = c.req.param("evaluationId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const existing = await loadRecord(slug, evaluationId);
    if (!existing) {
      return c.json({ error: "Evaluation not found" }, 404);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchAgentEvaluationBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const updated: AgentEvaluation = {
      ...existing,
      ...(parsed.data.quality_score !== undefined && {
        quality_score: parsed.data.quality_score,
      }),
      ...(parsed.data.quality_factors !== undefined && {
        quality_factors: parsed.data.quality_factors,
      }),
    };

    await saveRecord(slug, evaluationId, updated);
    return c.json(updated);
  }
);

// GET /hub/projects/:slug/evaluations — list with filters
evaluations.get("/hub/projects/:slug/evaluations", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const agentProfileFilter = c.req.query("agent_profile");
  const successFilter = c.req.query("success");
  const fromFilter = c.req.query("from");
  const limitParam = c.req.query("limit");
  const sortParam = c.req.query("sort") || "created_at_desc";
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  let records = await loadAllRecords(slug);

  if (agentProfileFilter) {
    records = records.filter((r) => r.agent_profile === agentProfileFilter);
  }

  if (successFilter !== undefined && successFilter !== null) {
    const success = successFilter === "true";
    records = records.filter((r) => r.success === success);
  }

  if (fromFilter) {
    const fromDate = new Date(fromFilter).getTime();
    records = records.filter(
      (r) => new Date(r.created_at).getTime() >= fromDate
    );
  }

  // Sort
  if (sortParam === "created_at_asc") {
    records.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  } else if (sortParam === "duration_desc") {
    records.sort((a, b) => b.duration_seconds - a.duration_seconds);
  } else if (sortParam === "quality_score_desc") {
    records.sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
  } else {
    // default: created_at_desc
    records.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  records = records.slice(0, limit);

  return c.json({ evaluations: records });
});

// GET /hub/projects/:slug/evaluations/:evaluationId — single record
evaluations.get(
  "/hub/projects/:slug/evaluations/:evaluationId",
  async (c) => {
    const slug = c.req.param("slug");
    const evaluationId = c.req.param("evaluationId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadRecord(slug, evaluationId);
    if (!record) {
      return c.json({ error: "Evaluation not found" }, 404);
    }

    return c.json(record);
  }
);

export { evaluations };

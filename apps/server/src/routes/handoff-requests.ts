import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  HandoffRequestSchema,
  HandoffTemplateSchema,
  CreateHandoffRequestBody,
  PatchHandoffRequestBody,
  PatchHandoffTemplateBody,
  type HandoffRequest,
  type HandoffTemplate,
} from "../schemas/handoff-request.js";
import { type Project } from "../schemas/project.js";

const handoffRequests = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function handoffRequestsDir(slug: string): string {
  return path.join(projectDir(slug), "handoff-requests");
}

function handoffRequestPath(slug: string, id: string): string {
  return path.join(handoffRequestsDir(slug), `${id}.json`);
}

function handoffTemplatePath(slug: string): string {
  return path.join(projectDir(slug), "handoff-template.json");
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

// --- HandoffRequest helpers ---

async function loadHandoffRequest(
  slug: string,
  id: string
): Promise<HandoffRequest | null> {
  try {
    return await readJSON<HandoffRequest>(handoffRequestPath(slug, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadAllHandoffRequests(slug: string): Promise<HandoffRequest[]> {
  const dir = handoffRequestsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const results: HandoffRequest[] = [];
  for (const file of files) {
    try {
      const record = await readJSON<HandoffRequest>(path.join(dir, file));
      results.push(record);
    } catch {
      // skip malformed files
    }
  }
  return results;
}

// --- HandoffTemplate helpers ---

async function loadHandoffTemplate(
  slug: string
): Promise<HandoffTemplate | null> {
  try {
    return await readJSON<HandoffTemplate>(handoffTemplatePath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

// --- Routes ---

// GET /hub/projects/:slug/handoff-requests — list with optional ?status= filter
handoffRequests.get("/hub/projects/:slug/handoff-requests", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const statusFilter = c.req.query("status");

  let records = await loadAllHandoffRequests(slug);

  if (statusFilter) {
    records = records.filter((r) => r.status === statusFilter);
  }

  records.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return c.json(records);
});

// POST /hub/projects/:slug/handoff-requests — create a new HandoffRequest
handoffRequests.post("/hub/projects/:slug/handoff-requests", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateHandoffRequestBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const record: HandoffRequest = {
    id,
    project_id: slug,
    title: parsed.data.title,
    source_type: parsed.data.source_type,
    source_ref: parsed.data.source_ref ?? null,
    description: parsed.data.description,
    status: "draft",
    generated_spec_id: null,
    generated_prp_id: null,
    feature_id: null,
    spec_approved: false,
    prp_approved: false,
    pm_notes: parsed.data.pm_notes ?? null,
    created_at: now,
    updated_at: now,
  };

  await ensureDir(handoffRequestsDir(slug));
  await writeJSON(handoffRequestPath(slug, id), record);

  return c.json(record, 201);
});

// GET /hub/projects/:slug/handoff-requests/:requestId — get a single HandoffRequest
handoffRequests.get(
  "/hub/projects/:slug/handoff-requests/:requestId",
  async (c) => {
    const slug = c.req.param("slug");
    const requestId = c.req.param("requestId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadHandoffRequest(slug, requestId);
    if (!record) return c.json({ error: "HandoffRequest not found" }, 404);

    return c.json(record);
  }
);

// PATCH /hub/projects/:slug/handoff-requests/:requestId — update a HandoffRequest
handoffRequests.patch(
  "/hub/projects/:slug/handoff-requests/:requestId",
  async (c) => {
    const slug = c.req.param("slug");
    const requestId = c.req.param("requestId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadHandoffRequest(slug, requestId);
    if (!record) return c.json({ error: "HandoffRequest not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchHandoffRequestBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const updated: HandoffRequest = {
      ...record,
      ...parsed.data,
      id: record.id,
      project_id: record.project_id,
      created_at: record.created_at,
      updated_at: new Date().toISOString(),
    };

    await writeJSON(handoffRequestPath(slug, requestId), updated);

    return c.json(updated);
  }
);

// DELETE /hub/projects/:slug/handoff-requests/:requestId — soft delete: set status=cancelled
handoffRequests.delete(
  "/hub/projects/:slug/handoff-requests/:requestId",
  async (c) => {
    const slug = c.req.param("slug");
    const requestId = c.req.param("requestId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadHandoffRequest(slug, requestId);
    if (!record) return c.json({ error: "HandoffRequest not found" }, 404);

    const updated: HandoffRequest = {
      ...record,
      status: "cancelled",
      updated_at: new Date().toISOString(),
    };

    await writeJSON(handoffRequestPath(slug, requestId), updated);

    return c.json(updated);
  }
);

// GET /hub/projects/:slug/handoff-template — get HandoffTemplate for the project
handoffRequests.get("/hub/projects/:slug/handoff-template", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const template = await loadHandoffTemplate(slug);
  if (!template) return c.json({ error: "HandoffTemplate not found" }, 404);

  return c.json(template);
});

// PUT /hub/projects/:slug/handoff-template — upsert HandoffTemplate
handoffRequests.put("/hub/projects/:slug/handoff-template", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const fullBody = HandoffTemplateSchema.omit({
    project_id: true,
    updated_at: true,
  }).safeParse(body);
  if (!fullBody.success) {
    return c.json(
      { error: "Validation failed", details: fullBody.error.flatten() },
      400
    );
  }

  const template: HandoffTemplate = {
    project_id: slug,
    spec_prompt_template: fullBody.data.spec_prompt_template,
    prp_prompt_template: fullBody.data.prp_prompt_template,
    default_sprint: fullBody.data.default_sprint,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(handoffTemplatePath(slug), template);

  return c.json(template, 201);
});

// PATCH /hub/projects/:slug/handoff-template — partial update HandoffTemplate
handoffRequests.patch("/hub/projects/:slug/handoff-template", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const existing = await loadHandoffTemplate(slug);
  if (!existing) return c.json({ error: "HandoffTemplate not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchHandoffTemplateBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const updated: HandoffTemplate = {
    ...existing,
    ...parsed.data,
    project_id: existing.project_id,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(handoffTemplatePath(slug), updated);

  return c.json(updated);
});

export { handoffRequests };

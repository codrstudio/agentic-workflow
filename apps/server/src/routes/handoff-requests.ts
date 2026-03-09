import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { spawnClaudeStream } from "../lib/claude-client.js";
import { config } from "../lib/config.js";
import {
  HandoffRequestSchema,
  HandoffTemplateSchema,
  CreateHandoffRequestBody,
  PatchHandoffRequestBody,
  PatchHandoffTemplateBody,
  EnqueueBody,
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

// --- SSE event bus ---

const handoffEventBus = new EventEmitter();
handoffEventBus.setMaxListeners(100);

interface HandoffEvent {
  type: "status_update" | "artifact_ready";
  request_id: string;
  status?: string;
  artifact_id?: string;
  timestamp: string;
}

function emitHandoffEvent(requestId: string, event: HandoffEvent): void {
  handoffEventBus.emit(`handoff:${requestId}`, event);
}

// --- ACR context helper ---

interface ACRRecord {
  id: string;
  status: string;
  [key: string]: unknown;
}

async function loadActiveACRs(slug: string): Promise<ACRRecord[]> {
  const dir = path.join(projectDir(slug), "acrs");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const results: ACRRecord[] = [];
  for (const file of files) {
    try {
      const record = await readJSON<ACRRecord>(path.join(dir, file));
      if (record.status === "active") results.push(record);
    } catch {
      // skip malformed
    }
  }
  return results;
}

// --- Feature ID generation ---

interface FeatureEntry {
  id: string;
  [key: string]: unknown;
}

function nextFeatureId(features: FeatureEntry[]): string {
  let maxNum = 0;
  for (const f of features) {
    const match = f.id.match(/^F-(\d+)$/);
    if (match) {
      const num = parseInt(match[1]!, 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `F-${String(maxNum + 1).padStart(3, "0")}`;
}

// --- Status transition + event emit helper ---

async function transitionStatus(
  slug: string,
  record: HandoffRequest,
  newStatus: HandoffRequest["status"],
  extraFields?: Partial<HandoffRequest>,
): Promise<HandoffRequest> {
  const now = new Date().toISOString();
  const updated: HandoffRequest = {
    ...record,
    ...extraFields,
    status: newStatus,
    updated_at: now,
  };
  await writeJSON(handoffRequestPath(slug, record.id), updated);

  emitHandoffEvent(record.id, {
    type: "status_update",
    request_id: record.id,
    status: newStatus,
    timestamp: now,
  });

  return updated;
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

  const patch = parsed.data;
  const updated: HandoffTemplate = {
    ...existing,
    ...patch,
    default_sprint: patch.default_sprint === null ? undefined : (patch.default_sprint ?? existing.default_sprint),
    project_id: existing.project_id,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(handoffTemplatePath(slug), updated);

  return c.json(updated);
});

// POST /hub/projects/:slug/handoff-requests/:requestId/generate-spec
handoffRequests.post(
  "/hub/projects/:slug/handoff-requests/:requestId/generate-spec",
  async (c) => {
    const slug = c.req.param("slug");
    const requestId = c.req.param("requestId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadHandoffRequest(slug, requestId);
    if (!record) return c.json({ error: "HandoffRequest not found" }, 404);

    if (record.status !== "draft") {
      return c.json(
        { error: `Pre-condition failed: status must be 'draft', got '${record.status}'` },
        422,
      );
    }

    const jobId = randomUUID();

    // Transition to generating_spec
    await transitionStatus(slug, record, "generating_spec");

    // Load template for prompt composition
    const template = await loadHandoffTemplate(slug);
    const specPromptTemplate =
      template?.spec_prompt_template ??
      "Generate a detailed technical specification for the following feature request.";

    // Build prompt with ACR context
    const activeACRs = await loadActiveACRs(slug);
    let prompt = `${specPromptTemplate}\n\n## Feature Request\n\n**Title:** ${record.title}\n\n**Description:**\n${record.description}`;

    if (record.pm_notes) {
      prompt += `\n\n**PM Notes:**\n${record.pm_notes}`;
    }

    if (activeACRs.length > 0) {
      prompt += `\n\n## Active Architectural Constraint Records (ACRs)\n\nThe following ACRs must be respected in the spec:\n\n`;
      for (const acr of activeACRs) {
        const title = (acr as Record<string, unknown>).title ?? acr.id;
        const constraint = (acr as Record<string, unknown>).constraint ?? "";
        prompt += `- **${title}**: ${constraint}\n`;
      }
    }

    // Spawn agent in background (fire-and-forget)
    const specId = randomUUID();
    spawnClaudeStream(
      { prompt, cwd: process.cwd(), maxTurns: 3 },
      {
        onDelta: () => {},
        onComplete: async () => {
          // Reload record in case it changed
          const current = await loadHandoffRequest(slug, requestId);
          if (current && current.status === "generating_spec") {
            await transitionStatus(slug, current, "spec_ready", {
              generated_spec_id: specId,
            });

            emitHandoffEvent(requestId, {
              type: "artifact_ready",
              request_id: requestId,
              artifact_id: specId,
              timestamp: new Date().toISOString(),
            });
          }
        },
        onError: async () => {
          // On error, revert to draft so PM can retry
          const current = await loadHandoffRequest(slug, requestId);
          if (current && current.status === "generating_spec") {
            await transitionStatus(slug, current, "draft");
          }
        },
      },
    );

    return c.json({ job_id: jobId, request_id: requestId, status: "generating_spec" }, 202);
  },
);

// POST /hub/projects/:slug/handoff-requests/:requestId/generate-prp
handoffRequests.post(
  "/hub/projects/:slug/handoff-requests/:requestId/generate-prp",
  async (c) => {
    const slug = c.req.param("slug");
    const requestId = c.req.param("requestId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadHandoffRequest(slug, requestId);
    if (!record) return c.json({ error: "HandoffRequest not found" }, 404);

    if (record.status !== "spec_ready") {
      return c.json(
        { error: `Pre-condition failed: status must be 'spec_ready', got '${record.status}'` },
        422,
      );
    }

    if (!record.spec_approved) {
      return c.json(
        { error: "Pre-condition failed: spec_approved must be true" },
        422,
      );
    }

    const jobId = randomUUID();

    // Transition to generating_prp
    await transitionStatus(slug, record, "generating_prp");

    // Load template for prompt composition
    const template = await loadHandoffTemplate(slug);
    const prpPromptTemplate =
      template?.prp_prompt_template ??
      "Generate a Product Requirements Plan (PRP) based on the following spec.";

    let prompt = `${prpPromptTemplate}\n\n## Spec\n\nSpec ID: ${record.generated_spec_id}\nTitle: ${record.title}\nDescription: ${record.description}`;

    if (record.pm_notes) {
      prompt += `\n\n**PM Notes:**\n${record.pm_notes}`;
    }

    // Spawn agent in background
    const prpId = randomUUID();
    spawnClaudeStream(
      { prompt, cwd: process.cwd(), maxTurns: 3 },
      {
        onDelta: () => {},
        onComplete: async () => {
          const current = await loadHandoffRequest(slug, requestId);
          if (current && current.status === "generating_prp") {
            await transitionStatus(slug, current, "prp_ready", {
              generated_prp_id: prpId,
            });

            emitHandoffEvent(requestId, {
              type: "artifact_ready",
              request_id: requestId,
              artifact_id: prpId,
              timestamp: new Date().toISOString(),
            });
          }
        },
        onError: async () => {
          const current = await loadHandoffRequest(slug, requestId);
          if (current && current.status === "generating_prp") {
            await transitionStatus(slug, current, "spec_ready");
          }
        },
      },
    );

    return c.json({ job_id: jobId, request_id: requestId, status: "generating_prp" }, 202);
  },
);

// POST /hub/projects/:slug/handoff-requests/:requestId/enqueue
handoffRequests.post(
  "/hub/projects/:slug/handoff-requests/:requestId/enqueue",
  async (c) => {
    const slug = c.req.param("slug");
    const requestId = c.req.param("requestId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const record = await loadHandoffRequest(slug, requestId);
    if (!record) return c.json({ error: "HandoffRequest not found" }, 404);

    if (record.status !== "prp_ready") {
      return c.json(
        { error: `Pre-condition failed: status must be 'prp_ready', got '${record.status}'` },
        422,
      );
    }

    if (!record.prp_approved) {
      return c.json(
        { error: "Pre-condition failed: prp_approved must be true" },
        422,
      );
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = EnqueueBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400,
      );
    }

    const { sprint, priority } = parsed.data;

    // Load or create features.json for the target sprint
    const sprintDir = path.join(config.projectsDir, slug, "sprints", `sprint-${sprint}`);
    await ensureDir(sprintDir);
    const featuresPath = path.join(sprintDir, "features.json");

    let features: FeatureEntry[];
    try {
      features = await readJSON<FeatureEntry[]>(featuresPath);
    } catch {
      features = [];
    }

    const featureId = nextFeatureId(features);

    const priorityMap: Record<string, number> = {
      high: 1,
      medium: 50,
      low: 99,
    };

    const newFeature = {
      id: featureId,
      name: record.title,
      description: record.description,
      status: "pending",
      priority: priorityMap[priority ?? "medium"] ?? 50,
      agent: "coder",
      task: "vibe-code",
      dependencies: [],
      tests: [],
      linked_handoff_id: record.id,
    };

    features.push(newFeature);
    await writeJSON(featuresPath, features);

    // Update handoff request
    const updated = await transitionStatus(slug, record, "enqueued", {
      feature_id: featureId,
    });

    return c.json({ feature_id: featureId, handoff_request: updated }, 201);
  },
);

// GET SSE /hub/projects/:slug/handoff-requests/:requestId/events
handoffRequests.get(
  "/hub/projects/:slug/handoff-requests/:requestId/events",
  (c) => {
    const requestId = c.req.param("requestId");

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          request_id: requestId,
          timestamp: new Date().toISOString(),
        }),
      });

      const listener = async (event: HandoffEvent) => {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });
        } catch {
          // Client disconnected
        }
      };

      handoffEventBus.on(`handoff:${requestId}`, listener);

      stream.onAbort(() => {
        handoffEventBus.off(`handoff:${requestId}`, listener);
      });

      // Heartbeat to keep connection alive
      while (true) {
        try {
          await stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({ timestamp: new Date().toISOString() }),
          });
          await stream.sleep(30000);
        } catch {
          break;
        }
      }

      handoffEventBus.off(`handoff:${requestId}`, listener);
    });
  },
);

export { handoffRequests };

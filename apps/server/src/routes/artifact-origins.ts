import { Hono } from "hono";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ArtifactOriginSchema,
  CreateOriginBody,
  PatchOriginBody,
  type ArtifactOrigin,
  type OriginSource,
} from "../schemas/artifact-origin.js";
import { type Project } from "../schemas/project.js";

const artifactOrigins = new Hono();

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

function originsDir(slug: string): string {
  return path.join(projectDir(slug), "artifact-origins");
}

function originPath(slug: string, artifactId: string): string {
  return path.join(originsDir(slug), `${artifactId}.json`);
}

async function loadOrigin(
  slug: string,
  artifactId: string
): Promise<ArtifactOrigin | null> {
  try {
    return await readJSON<ArtifactOrigin>(originPath(slug, artifactId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function resolveAutoTag(context?: string): OriginSource {
  switch (context) {
    case "chat":
      return "ai_generated";
    case "manual":
      return "human_written";
    case "harness":
      return "ai_generated";
    case "edit_after_ai":
      return "mixed";
    default:
      return "human_written";
  }
}

// POST /hub/projects/:slug/origins — create origin record
artifactOrigins.post("/hub/projects/:slug/origins", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateOriginBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { artifact_id, artifact_type, origin, agent_model, session_id, tagged_by, context } =
    parsed.data;

  const resolvedOrigin: OriginSource = origin ?? resolveAutoTag(context);

  const record: ArtifactOrigin = {
    artifact_id,
    artifact_type,
    origin: resolvedOrigin,
    agent_model,
    session_id,
    tagged_at: new Date().toISOString(),
    tagged_by,
  };

  await ensureDir(originsDir(slug));
  await writeJSON(originPath(slug, artifact_id), record);

  return c.json(record, 201);
});

// GET /hub/projects/:slug/origins/:artifactId — get origin
artifactOrigins.get("/hub/projects/:slug/origins/:artifactId", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const artifactId = c.req.param("artifactId");
  const origin = await loadOrigin(slug, artifactId);
  if (!origin) return c.json({ error: "Origin not found" }, 404);

  return c.json(origin);
});

// PATCH /hub/projects/:slug/origins — update origin (manual correction)
artifactOrigins.patch("/hub/projects/:slug/origins", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Body must include artifact_id to identify which origin to update
  const bodyWithId = body as Record<string, unknown>;
  const artifactId = bodyWithId?.artifact_id;
  if (!artifactId || typeof artifactId !== "string") {
    return c.json({ error: "artifact_id is required" }, 400);
  }

  const parsed = PatchOriginBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const existing = await loadOrigin(slug, artifactId);
  if (!existing) return c.json({ error: "Origin not found" }, 404);

  const updated: ArtifactOrigin = {
    ...existing,
    origin: parsed.data.origin,
    tagged_by: parsed.data.tagged_by,
    tagged_at: new Date().toISOString(),
  };

  await writeJSON(originPath(slug, artifactId), updated);

  return c.json(updated);
});

export { artifactOrigins };

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir, unlink } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateSessionBody,
  UpdateSessionBody,
  type ChatSession,
} from "../schemas/session.js";
import { type Project } from "../schemas/project.js";

const sessions = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function sessionsDir(slug: string): string {
  return path.join(projectDir(slug), "sessions");
}

function sessionPath(slug: string, id: string): string {
  return path.join(sessionsDir(slug), `${id}.json`);
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

async function loadSession(
  slug: string,
  id: string
): Promise<ChatSession | null> {
  try {
    return await readJSON<ChatSession>(sessionPath(slug, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveSession(
  slug: string,
  session: ChatSession
): Promise<void> {
  await ensureDir(sessionsDir(slug));
  await writeJSON(sessionPath(slug, session.id), session);
}

async function listSessionFiles(slug: string): Promise<string[]> {
  const dir = sessionsDir(slug);
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
}

function generateTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 50) return cleaned;
  return cleaned.slice(0, 47) + "...";
}

// GET /hub/projects/:slug/sessions — list sessions (no messages)
sessions.get("/hub/projects/:slug/sessions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const files = await listSessionFiles(slug);
  const all: ChatSession[] = [];

  for (const file of files) {
    try {
      const session = await readJSON<ChatSession>(
        path.join(sessionsDir(slug), file)
      );
      all.push(session);
    } catch {
      // skip corrupt files
    }
  }

  // Sort by updated_at DESC
  all.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  // Strip messages for list response
  const result = all.map(({ messages, ...rest }) => ({
    ...rest,
    message_count: messages.length,
  }));

  return c.json(result);
});

// POST /hub/projects/:slug/sessions — create session
sessions.post("/hub/projects/:slug/sessions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateSessionBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { title, source_ids } = parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();

  const session: ChatSession = {
    id,
    project_id: project.id,
    title: title || "Nova conversa",
    source_ids,
    messages: [],
    created_at: now,
    updated_at: now,
    status: "active",
  };

  await saveSession(slug, session);

  return c.json(session, 201);
});

// GET /hub/projects/:slug/sessions/:id — get session with messages
sessions.get("/hub/projects/:slug/sessions/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const session = await loadSession(slug, id);
  if (!session) return c.json({ error: "Session not found" }, 404);

  return c.json(session);
});

// PATCH /hub/projects/:slug/sessions/:id — update session (archive, title)
sessions.patch("/hub/projects/:slug/sessions/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const session = await loadSession(slug, id);
  if (!session) return c.json({ error: "Session not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = UpdateSessionBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const updates = parsed.data;
  if (updates.title !== undefined) session.title = updates.title;
  if (updates.status !== undefined) session.status = updates.status;
  session.updated_at = new Date().toISOString();

  await saveSession(slug, session);

  return c.json(session);
});

// DELETE /hub/projects/:slug/sessions/:id — delete session
sessions.delete("/hub/projects/:slug/sessions/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const session = await loadSession(slug, id);
  if (!session) return c.json({ error: "Session not found" }, 404);

  // Remove session JSON file
  try {
    await unlink(sessionPath(slug, id));
  } catch {
    // ignore
  }

  // Remove JSONL audit file if exists
  try {
    await unlink(path.join(sessionsDir(slug), `${id}.jsonl`));
  } catch {
    // ignore
  }

  return c.body(null, 204);
});

export { sessions, generateTitle };

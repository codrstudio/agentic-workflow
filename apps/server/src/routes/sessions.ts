import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir, unlink, appendFile } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { getClaudeClient } from "../lib/claude-client.js";
import { composePrompt, type ChatMessage } from "../lib/context-composer.js";
import {
  CreateSessionBody,
  UpdateSessionBody,
  type ChatSession,
  type Message,
} from "../schemas/session.js";
import { type Project } from "../schemas/project.js";
import { type Source } from "../schemas/source.js";

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

  // Strip messages for list response, include last message preview
  const result = all.map(({ messages, ...rest }) => {
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    return {
      ...rest,
      message_count: messages.length,
      last_message_preview: lastMsg
        ? lastMsg.content.replace(/\s+/g, " ").trim().slice(0, 120)
        : null,
      last_message_role: lastMsg?.role ?? null,
    };
  });

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

// --- SSE streaming endpoint ---

function sourcesJsonPath(slug: string): string {
  return path.join(projectDir(slug), "sources", "sources.json");
}

async function loadSources(slug: string): Promise<Source[]> {
  try {
    return await readJSON<Source[]>(sourcesJsonPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

function jsonlPath(slug: string, sessionId: string): string {
  return path.join(sessionsDir(slug), `${sessionId}.jsonl`);
}

async function appendAuditLog(
  slug: string,
  sessionId: string,
  entry: Record<string, unknown>
): Promise<void> {
  const line = JSON.stringify(entry) + "\n";
  await appendFile(jsonlPath(slug, sessionId), line, "utf-8");
}

// POST /hub/projects/:slug/sessions/:id/messages — send message, stream response via SSE
sessions.post("/hub/projects/:slug/sessions/:id/messages", async (c) => {
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

  const content =
    body && typeof body === "object" && "content" in body
      ? (body as { content: unknown }).content
      : undefined;

  if (typeof content !== "string" || content.trim().length === 0) {
    return c.json({ error: "content is required" }, 400);
  }

  // 1. Save user message to session
  const userMessageId = randomUUID();
  const userMessage: Message = {
    id: userMessageId,
    role: "user",
    content: content.trim(),
    created_at: new Date().toISOString(),
    artifacts: [],
  };

  session.messages.push(userMessage);

  // Auto-generate title on first user message
  if (
    session.messages.filter((m) => m.role === "user").length === 1 &&
    session.title === "Nova conversa"
  ) {
    session.title = generateTitle(content.trim());
  }

  session.updated_at = new Date().toISOString();
  await saveSession(slug, session);

  // 2. Load sources for context composition
  const allSources = await loadSources(slug);
  const selectedSources = allSources.filter((s) =>
    session.source_ids.includes(s.id)
  );

  // 3. Compose prompt
  const history: ChatMessage[] = session.messages.slice(0, -1).map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  const composed = await composePrompt(
    {
      project: { name: project.name, description: project.description },
      sources: selectedSources,
      history,
      message: content.trim(),
    },
    slug
  );

  // 4. Stream response via SSE
  const assistantMessageId = randomUUID();

  return streamSSE(c, async (stream) => {
    let fullContent = "";

    try {
      // Emit message.start
      await stream.writeSSE({
        event: "message.start",
        data: JSON.stringify({ message_id: assistantMessageId }),
      });

      // Invoke Claude with streaming
      const claude = getClaudeClient();
      const anthropicStream = claude.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: composed.system,
        messages: composed.messages.map((m) => ({
          role: m.role === "system" ? ("user" as const) : (m.role as "user" | "assistant"),
          content: m.content,
        })),
      });

      for await (const event of anthropicStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const text = event.delta.text;
          fullContent += text;
          await stream.writeSSE({
            event: "message.delta",
            data: JSON.stringify({ content: text }),
          });
        }
      }

      // 5. Save assistant message to session
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: fullContent,
        created_at: new Date().toISOString(),
        artifacts: [],
      };

      // Re-load session to avoid stale data
      const freshSession = await loadSession(slug, id);
      if (freshSession) {
        freshSession.messages.push(assistantMessage);
        freshSession.updated_at = new Date().toISOString();
        await saveSession(slug, freshSession);
      }

      // 6. Append to JSONL audit trail
      await appendAuditLog(slug, id, {
        timestamp: new Date().toISOString(),
        user_message_id: userMessageId,
        assistant_message_id: assistantMessageId,
        user_content: content.trim(),
        assistant_content: fullContent,
        model: "claude-sonnet-4-20250514",
      });

      // Emit message.complete
      await stream.writeSSE({
        event: "message.complete",
        data: JSON.stringify({
          message_id: assistantMessageId,
          artifacts: [],
        }),
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error";
      await stream.writeSSE({
        event: "message.error",
        data: JSON.stringify({ error: errorMessage }),
      });
    }
  });
});

export { sessions, generateTitle };

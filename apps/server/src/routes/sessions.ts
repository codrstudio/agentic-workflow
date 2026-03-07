import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir, unlink, appendFile, writeFile } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { spawnClaudeStream } from "../lib/claude-client.js";
import { composePrompt, type ChatMessage } from "../lib/context-composer.js";
import { extractArtifacts } from "../lib/artifact-detector.js";
import {
  collectMcpTools,
  formatMcpToolsForPrompt,
  parseMcpToolCalls,
  executeMcpToolCall,
  formatToolResults,
  type McpToolDefinition,
} from "../lib/mcp-chat-tools.js";
import {
  CreateSessionBody,
  UpdateSessionBody,
  type ChatSession,
  type Message,
} from "../schemas/session.js";
import { type Project } from "../schemas/project.js";
import { type Source } from "../schemas/source.js";
import { type Artifact } from "../schemas/artifact.js";

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

  const { title, source_ids, system_message } = parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();

  const messages: Message[] = [];
  if (system_message) {
    messages.push({
      id: randomUUID(),
      role: "system",
      content: system_message,
      created_at: now,
      artifacts: [],
    });
  }

  const session: ChatSession = {
    id,
    project_id: project.id,
    title: title || "Nova conversa",
    source_ids,
    messages,
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

const INLINE_THRESHOLD = 50 * 1024; // 50KB

function artifactsJsonPath(slug: string): string {
  return path.join(projectDir(slug), "artifacts", "artifacts.json");
}

function artifactFilesDir(slug: string): string {
  return path.join(projectDir(slug), "artifacts", "files");
}

function extensionForType(type: string): string {
  switch (type) {
    case "document": return "md";
    case "code": return "txt";
    case "json": return "json";
    case "diagram": return "mmd";
    case "config": return "yaml";
    default: return "txt";
  }
}

async function loadArtifacts(slug: string): Promise<Artifact[]> {
  try {
    return await readJSON<Artifact[]>(artifactsJsonPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveArtifacts(slug: string, data: Artifact[]): Promise<void> {
  await ensureDir(path.join(projectDir(slug), "artifacts"));
  await writeJSON(artifactsJsonPath(slug), data);
}

async function createChatArtifacts(
  slug: string,
  projectId: string,
  sessionId: string,
  fullContent: string,
): Promise<string[]> {
  const detected = extractArtifacts(fullContent);
  if (detected.length === 0) return [];

  const all = await loadArtifacts(slug);
  const createdIds: string[] = [];
  const now = new Date().toISOString();

  for (const det of detected) {
    const id = randomUUID();
    const sizeBytes = Buffer.byteLength(det.content, "utf-8");

    let inlineContent: string | undefined;
    let filePath: string | undefined;

    if (sizeBytes > INLINE_THRESHOLD) {
      const ext = extensionForType(det.type);
      const fileName = `${id}.${ext}`;
      filePath = `files/${fileName}`;
      const dir = artifactFilesDir(slug);
      await ensureDir(dir);
      await writeFile(path.join(dir, fileName), det.content, "utf-8");
    } else {
      inlineContent = det.content;
    }

    const artifact: Artifact = {
      id,
      project_id: projectId,
      name: det.name,
      type: det.type,
      origin: "chat",
      content: inlineContent,
      file_path: filePath,
      session_id: sessionId,
      version: 1,
      tags: det.language ? [det.language] : [],
      created_at: now,
      updated_at: now,
    };

    all.push(artifact);
    createdIds.push(id);
  }

  await saveArtifacts(slug, all);
  return createdIds;
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

  // 3. Collect MCP tools from connected servers
  let mcpTools: McpToolDefinition[] = [];
  try {
    mcpTools = await collectMcpTools(slug);
  } catch {
    // MCP tool collection failure should not block chat
  }
  const mcpToolsSection =
    mcpTools.length > 0 ? formatMcpToolsForPrompt(mcpTools) : undefined;

  // 4. Compose prompt
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
      mcpToolsSection,
    },
    slug
  );

  // 5. Stream response via SSE using Claude Code CLI
  const assistantMessageId = randomUUID();

  // Build the user prompt from composed messages
  const userPrompt = composed.messages
    .map((m) => {
      const prefix = m.role === "user" ? "User" : "Assistant";
      return `${prefix}: ${m.content}`;
    })
    .join("\n\n");

  const MAX_TOOL_ITERATIONS = 5;

  return streamSSE(c, async (stream) => {
    // Emit message.start
    await stream.writeSSE({
      event: "message.start",
      data: JSON.stringify({ message_id: assistantMessageId }),
    });

    let currentPrompt = userPrompt;
    let accumulatedContent = "";
    let iteration = 0;

    // Tool-use loop: run Claude, check for MCP tool calls, execute, re-prompt
    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const iterationContent = await new Promise<string>((resolve) => {
        const proc = spawnClaudeStream(
          {
            prompt: currentPrompt,
            systemPrompt: composed.system,
            cwd: projectDir(slug),
          },
          {
            onDelta: async (text) => {
              try {
                await stream.writeSSE({
                  event: "message.delta",
                  data: JSON.stringify({ content: text }),
                });
              } catch {
                proc.kill("SIGTERM");
              }
            },
            onJsonlLine: (line) => {
              appendFile(jsonlPath(slug, id), line + "\n", "utf-8").catch(
                () => {},
              );
            },
            onComplete: (fullContent) => {
              resolve(fullContent);
            },
            onError: async (errorMessage) => {
              await stream.writeSSE({
                event: "message.error",
                data: JSON.stringify({ error: errorMessage }),
              });
              resolve("");
            },
          },
        );
      });

      accumulatedContent += iterationContent;

      // Check for MCP tool calls in the response (only if we have MCP tools)
      if (mcpTools.length === 0) break;

      const toolCalls = parseMcpToolCalls(iterationContent);
      if (toolCalls.length === 0) break;

      // Emit tool execution event to client
      await stream.writeSSE({
        event: "mcp.tool_calls",
        data: JSON.stringify({
          tools: toolCalls.map((tc) => tc.toolName),
        }),
      });

      // Execute all tool calls
      const results = await Promise.all(
        toolCalls.map((tc) =>
          executeMcpToolCall(slug, tc.toolName, tc.args, mcpTools).catch(
            (err): { toolName: string; success: false; error: string } => ({
              toolName: tc.toolName,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          ),
        ),
      );

      // Emit tool results event to client
      await stream.writeSSE({
        event: "mcp.tool_results",
        data: JSON.stringify({ results }),
      });

      // Build follow-up prompt with tool results
      const toolResultsText = formatToolResults(results);
      currentPrompt = `Here are the results from the MCP tool calls you made:\n\n${toolResultsText}\n\nPlease continue your response based on these results.`;
    }

    // Finalize: detect artifacts, save message, emit complete
    try {
      const artifactIds = await createChatArtifacts(
        slug,
        project.id,
        id,
        accumulatedContent,
      );

      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: accumulatedContent,
        created_at: new Date().toISOString(),
        artifacts: artifactIds,
      };

      const freshSession = await loadSession(slug, id);
      if (freshSession) {
        freshSession.messages.push(assistantMessage);
        freshSession.updated_at = new Date().toISOString();
        await saveSession(slug, freshSession);
      }

      await appendAuditLog(slug, id, {
        timestamp: new Date().toISOString(),
        user_message_id: userMessageId,
        assistant_message_id: assistantMessageId,
        user_content: content.trim(),
        assistant_content: accumulatedContent,
        artifact_ids: artifactIds,
        mcp_tools_available: mcpTools.length,
      });

      await stream.writeSSE({
        event: "message.complete",
        data: JSON.stringify({
          message_id: assistantMessageId,
          artifacts: artifactIds,
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

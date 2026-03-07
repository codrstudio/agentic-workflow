import { Hono } from "hono";
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { getMcpManager } from "../lib/mcp-manager.js";
import { type Source } from "../schemas/source.js";

// --- Types ---

type McpTransport = "stdio" | "sse";

interface McpServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: McpTransport;
  command?: string;
  args: string[];
  env: Record<string, string>;
  url?: string;
  enabled: boolean;
  status: "disconnected" | "connecting" | "connected" | "error";
  last_error?: string;
  created_at: string;
}

// --- Helpers ---

function serversPath(slug: string): string {
  return path.join(config.projectsDir, slug, "mcp", "servers.json");
}

async function loadServers(slug: string): Promise<McpServerConfig[]> {
  try {
    return await readJSON<McpServerConfig[]>(serversPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return [];
    }
    throw err;
  }
}

async function saveServers(
  slug: string,
  servers: McpServerConfig[]
): Promise<void> {
  const filePath = serversPath(slug);
  await ensureDir(path.dirname(filePath));
  await writeJSON(filePath, servers);
}

function validateCreate(body: Record<string, unknown>): string | null {
  if (!body.name || typeof body.name !== "string" || body.name.trim() === "") {
    return "name is required";
  }
  if (!body.transport || !["stdio", "sse"].includes(body.transport as string)) {
    return "transport must be 'stdio' or 'sse'";
  }
  if (body.transport === "stdio") {
    if (!body.command || typeof body.command !== "string" || (body.command as string).trim() === "") {
      return "command is required for stdio transport";
    }
  }
  if (body.transport === "sse") {
    if (!body.url || typeof body.url !== "string" || (body.url as string).trim() === "") {
      return "url is required for sse transport";
    }
  }
  return null;
}

// --- Routes ---

const mcpServers = new Hono();

// GET /hub/projects/:slug/mcp/servers
mcpServers.get("/hub/projects/:slug/mcp/servers", async (c) => {
  const slug = c.req.param("slug");
  const servers = await loadServers(slug);

  // Enrich with live status from manager
  const manager = getMcpManager(slug);
  for (const server of servers) {
    const live = manager.getStatus(server.id);
    server.status = live.status;
    server.last_error = live.last_error;
  }

  return c.json({ servers });
});

// POST /hub/projects/:slug/mcp/servers
mcpServers.post("/hub/projects/:slug/mcp/servers", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<Record<string, unknown>>();

  const error = validateCreate(body);
  if (error) {
    return c.json({ error }, 400);
  }

  const transport = body.transport as McpTransport;

  const server: McpServerConfig = {
    id: crypto.randomUUID(),
    name: (body.name as string).trim(),
    description: typeof body.description === "string" ? body.description.trim() : undefined,
    transport,
    command: transport === "stdio" ? (body.command as string).trim() : undefined,
    args: transport === "stdio" && Array.isArray(body.args)
      ? (body.args as string[])
      : [],
    env: transport === "stdio" && body.env && typeof body.env === "object" && !Array.isArray(body.env)
      ? (body.env as Record<string, string>)
      : {},
    url: transport === "sse" ? (body.url as string).trim() : undefined,
    enabled: body.enabled !== false,
    status: "disconnected",
    created_at: new Date().toISOString(),
  };

  const servers = await loadServers(slug);
  servers.push(server);
  await saveServers(slug, servers);

  return c.json({ server }, 201);
});

// PATCH /hub/projects/:slug/mcp/servers/:id
mcpServers.patch("/hub/projects/:slug/mcp/servers/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const servers = await loadServers(slug);
  const idx = servers.findIndex((s) => s.id === id);
  if (idx === -1) {
    return c.json({ error: "Server not found" }, 404);
  }

  const server = servers[idx]!;

  if (typeof body.name === "string") server.name = body.name.trim();
  if (typeof body.description === "string") server.description = body.description.trim();
  if (typeof body.enabled === "boolean") server.enabled = body.enabled;
  if (typeof body.command === "string") server.command = body.command.trim();
  if (Array.isArray(body.args)) server.args = body.args as string[];
  if (body.env && typeof body.env === "object" && !Array.isArray(body.env)) {
    server.env = body.env as Record<string, string>;
  }
  if (typeof body.url === "string") server.url = body.url.trim();

  servers[idx] = server;
  await saveServers(slug, servers);

  return c.json({ server });
});

// DELETE /hub/projects/:slug/mcp/servers/:id
mcpServers.delete("/hub/projects/:slug/mcp/servers/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");

  const servers = await loadServers(slug);
  const idx = servers.findIndex((s) => s.id === id);
  if (idx === -1) {
    return c.json({ error: "Server not found" }, 404);
  }

  // Disconnect before removing
  const manager = getMcpManager(slug);
  await manager.disconnect(id);

  servers.splice(idx, 1);
  await saveServers(slug, servers);

  return c.body(null, 204);
});

// POST /hub/projects/:slug/mcp/servers/:id/connect
mcpServers.post("/hub/projects/:slug/mcp/servers/:id/connect", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const body = await c.req.json<{ action?: string }>();

  const action = body.action;
  if (action !== "connect" && action !== "disconnect") {
    return c.json({ error: "action must be 'connect' or 'disconnect'" }, 400);
  }

  const servers = await loadServers(slug);
  const idx = servers.findIndex((s) => s.id === id);
  if (idx === -1) {
    return c.json({ error: "Server not found" }, 404);
  }

  const server = servers[idx]!;
  const manager = getMcpManager(slug);

  if (action === "connect") {
    server.status = "connecting";
    await saveServers(slug, servers);

    const result = await manager.connect(server);
    server.status = result.status;
    server.last_error = result.last_error;
    await saveServers(slug, servers);
  } else {
    await manager.disconnect(id);
    server.status = "disconnected";
    server.last_error = undefined;
    await saveServers(slug, servers);
  }

  return c.json({ server });
});

// GET /hub/projects/:slug/mcp/servers/:id/status
mcpServers.get("/hub/projects/:slug/mcp/servers/:id/status", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");

  const servers = await loadServers(slug);
  const server = servers.find((s) => s.id === id);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  // Get live status from manager (may differ from persisted)
  const manager = getMcpManager(slug);
  const liveStatus = manager.getStatus(id);

  return c.json({
    id: server.id,
    status: liveStatus.status,
    last_error: liveStatus.last_error,
  });
});

// --- Discovery Endpoints (F-080) ---

// GET /hub/projects/:slug/mcp/servers/:id/tools
mcpServers.get("/hub/projects/:slug/mcp/servers/:id/tools", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");

  const servers = await loadServers(slug);
  const server = servers.find((s) => s.id === id);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const manager = getMcpManager(slug);
  const client = manager.getClient(id);
  if (!client || client.status !== "connected") {
    return c.json({ error: "Server not connected" }, 409);
  }

  const tools = await client.listTools();
  return c.json({ tools });
});

// GET /hub/projects/:slug/mcp/servers/:id/resources
mcpServers.get("/hub/projects/:slug/mcp/servers/:id/resources", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");

  const servers = await loadServers(slug);
  const server = servers.find((s) => s.id === id);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const manager = getMcpManager(slug);
  const client = manager.getClient(id);
  if (!client || client.status !== "connected") {
    return c.json({ error: "Server not connected" }, 409);
  }

  const resources = await client.listResources();
  return c.json({ resources });
});

// POST /hub/projects/:slug/mcp/servers/:id/resources/import
mcpServers.post("/hub/projects/:slug/mcp/servers/:id/resources/import", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const body = await c.req.json<{ uri?: string }>();

  if (!body.uri || typeof body.uri !== "string") {
    return c.json({ error: "uri is required" }, 400);
  }

  const servers = await loadServers(slug);
  const server = servers.find((s) => s.id === id);
  if (!server) {
    return c.json({ error: "Server not found" }, 404);
  }

  const manager = getMcpManager(slug);
  const client = manager.getClient(id);
  if (!client || client.status !== "connected") {
    return c.json({ error: "Server not connected" }, 409);
  }

  // Read the resource content via MCP
  const result = await client.readResource(body.uri);
  const firstContent = result.contents[0];
  const text = firstContent?.text ?? "";

  // Determine source name from URI
  const uriParts = body.uri.split("/");
  const sourceName = uriParts[uriParts.length - 1] || body.uri;

  // Load project to get project_id
  const projectJsonPath = path.join(config.projectsDir, slug, "project.json");
  const project = await readJSON<{ id: string }>(projectJsonPath);

  // Create source with category 'reference'
  const now = new Date().toISOString();
  const sourceId = crypto.randomUUID();
  const sizeBytes = Buffer.byteLength(text, "utf-8");

  const source: Source = {
    id: sourceId,
    project_id: project.id,
    name: sourceName,
    type: "text",
    content: text,
    file_path: undefined,
    url: undefined,
    size_bytes: sizeBytes,
    created_at: now,
    updated_at: now,
    tags: [`mcp:${server.name}`, `uri:${body.uri}`],
    category: "reference",
    pinned: false,
    auto_include: false,
    relevance_tags: [],
  };

  // Persist to sources.json
  const sourcesJsonPath = path.join(config.projectsDir, slug, "sources", "sources.json");
  let allSources: Source[] = [];
  try {
    allSources = await readJSON<Source[]>(sourcesJsonPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("not found") && !msg.includes("ENOENT")) {
      throw err;
    }
  }

  allSources.push(source);
  await ensureDir(path.join(config.projectsDir, slug, "sources"));
  await writeJSON(sourcesJsonPath, allSources);

  return c.json({ source }, 201);
});

export { mcpServers };

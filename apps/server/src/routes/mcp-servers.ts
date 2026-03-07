import { Hono } from "hono";
import path from "node:path";
import crypto from "node:crypto";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";

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

  servers.splice(idx, 1);
  await saveServers(slug, servers);

  return c.body(null, 204);
});

export { mcpServers };

import { Hono } from "hono";
import path from "node:path";
import crypto from "node:crypto";
import { readdir, unlink } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  MCPServerRegistrySchema,
  CreateMCPServerRegistrySchema,
  UpdateMCPServerRegistrySchema,
  type MCPServerRegistry,
} from "../schemas/mcp-registry.js";
import { type Project } from "../schemas/project.js";

// --- Helpers ---

function mcpServersDir(slug: string): string {
  return path.join(config.projectsDir, slug, "mcp", "servers");
}

function serverFilePath(slug: string, id: string): string {
  return path.join(mcpServersDir(slug), `${id}.json`);
}

async function loadServer(slug: string, id: string): Promise<MCPServerRegistry | null> {
  try {
    const data = await readJSON<MCPServerRegistry>(serverFilePath(slug, id));
    return MCPServerRegistrySchema.parse(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) return null;
    throw err;
  }
}

async function saveServer(slug: string, server: MCPServerRegistry): Promise<void> {
  const dir = mcpServersDir(slug);
  await ensureDir(dir);
  await writeJSON(serverFilePath(slug, server.id), server);
}

async function listServers(slug: string): Promise<MCPServerRegistry[]> {
  const dir = mcpServersDir(slug);
  try {
    const entries = await readdir(dir);
    const jsonFiles = entries.filter((e) => e.endsWith(".json"));
    const servers = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const data = await readJSON<MCPServerRegistry>(path.join(dir, file));
          return MCPServerRegistrySchema.parse(data);
        } catch {
          return null;
        }
      }),
    );
    return servers.filter((s): s is MCPServerRegistry => s !== null);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(path.join(config.projectsDir, slug, "project.json"));
  } catch {
    return null;
  }
}

// --- Routes ---

const mcpServers = new Hono();

// GET /hub/projects/:slug/mcp/servers
mcpServers.get("/hub/projects/:slug/mcp/servers", async (c) => {
  const slug = c.req.param("slug");
  const servers = await listServers(slug);
  servers.sort((a, b) => a.created_at.localeCompare(b.created_at));
  return c.json({ servers });
});

// POST /hub/projects/:slug/mcp/servers
mcpServers.post("/hub/projects/:slug/mcp/servers", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<Record<string, unknown>>();

  const parsed = CreateMCPServerRegistrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
  }

  const project = await loadProject(slug);
  const projectId = project?.id ?? crypto.randomUUID();

  const now = new Date().toISOString();
  const server: MCPServerRegistry = {
    id: crypto.randomUUID(),
    project_id: projectId,
    name: parsed.data.name,
    server_url: parsed.data.server_url,
    transport: parsed.data.transport,
    status: parsed.data.status ?? "active",
    tools_available: parsed.data.tools_available ?? [],
    allowed_agents: parsed.data.allowed_agents ?? [],
    requires_approval: parsed.data.requires_approval ?? false,
    cost_per_call_usd: parsed.data.cost_per_call_usd ?? null,
    monthly_budget_usd: parsed.data.monthly_budget_usd ?? null,
    current_month_spend_usd: 0,
    last_health_check: null,
    avg_latency_ms: null,
    error_rate: 0,
    created_at: now,
    updated_at: now,
  };

  await saveServer(slug, server);
  return c.json({ server }, 201);
});

// GET /hub/projects/:slug/mcp/servers/:id
mcpServers.get("/hub/projects/:slug/mcp/servers/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");

  const server = await loadServer(slug, id);
  if (!server) return c.json({ error: "Server not found" }, 404);
  return c.json({ server });
});

// PUT /hub/projects/:slug/mcp/servers/:id
mcpServers.put("/hub/projects/:slug/mcp/servers/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();

  const server = await loadServer(slug, id);
  if (!server) return c.json({ error: "Server not found" }, 404);

  const parsed = UpdateMCPServerRegistrySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
  }

  const updates = parsed.data;
  if (updates.name !== undefined) server.name = updates.name;
  if (updates.server_url !== undefined) server.server_url = updates.server_url;
  if (updates.transport !== undefined) server.transport = updates.transport;
  if (updates.status !== undefined) server.status = updates.status;
  if (updates.tools_available !== undefined) server.tools_available = updates.tools_available;
  if (updates.allowed_agents !== undefined) server.allowed_agents = updates.allowed_agents;
  if (updates.requires_approval !== undefined) server.requires_approval = updates.requires_approval;
  if (updates.cost_per_call_usd !== undefined) server.cost_per_call_usd = updates.cost_per_call_usd;
  if (updates.monthly_budget_usd !== undefined) server.monthly_budget_usd = updates.monthly_budget_usd;
  if (updates.current_month_spend_usd !== undefined) server.current_month_spend_usd = updates.current_month_spend_usd;
  if (updates.error_rate !== undefined) server.error_rate = updates.error_rate;
  server.updated_at = new Date().toISOString();

  await saveServer(slug, server);
  return c.json({ server });
});

// DELETE /hub/projects/:slug/mcp/servers/:id
mcpServers.delete("/hub/projects/:slug/mcp/servers/:id", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");

  const server = await loadServer(slug, id);
  if (!server) return c.json({ error: "Server not found" }, 404);

  try {
    await unlink(serverFilePath(slug, id));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code !== "ENOENT") throw err;
  }

  return c.body(null, 204);
});

// POST /hub/projects/:slug/mcp/servers/:id/health
mcpServers.post("/hub/projects/:slug/mcp/servers/:id/health", async (c) => {
  const slug = c.req.param("slug");
  const id = c.req.param("id");

  const server = await loadServer(slug, id);
  if (!server) return c.json({ error: "Server not found" }, 404);

  const start = Date.now();
  let status: "active" | "error" = "active";
  const tools_count = server.tools_available.length;

  try {
    if (
      server.transport === "sse" ||
      server.transport === "streamable-http" ||
      server.server_url.startsWith("http")
    ) {
      const response = await fetch(server.server_url, {
        signal: AbortSignal.timeout(5000),
      });
      // 4xx client errors still mean server is reachable (active)
      status = response.status < 500 ? "active" : "error";
    } else {
      // stdio transport with non-HTTP url: assume active if configured
      status = "active";
    }
  } catch {
    status = "error";
  }

  const latency_ms = Date.now() - start;

  // Update server health metrics
  server.last_health_check = new Date().toISOString();
  server.avg_latency_ms =
    server.avg_latency_ms !== null
      ? Math.round((server.avg_latency_ms + latency_ms) / 2)
      : latency_ms;
  server.status = status;
  server.updated_at = new Date().toISOString();

  await saveServer(slug, server);

  return c.json({ status, latency_ms, tools_count });
});

export { mcpServers };

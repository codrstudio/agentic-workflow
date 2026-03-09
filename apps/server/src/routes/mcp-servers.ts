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
  MCPAuditLogSchema,
  CreateMCPAuditLogSchema,
  MCPGovernanceMetricsSchema,
  MCPMetricsCacheSchema,
  type MCPServerRegistry,
  type MCPAuditLog,
  type MCPGovernanceMetrics,
  type MCPMetricsCache,
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

// --- Audit Log helpers ---

function mcpAuditDir(slug: string): string {
  return path.join(config.projectsDir, slug, "mcp", "audit");
}

function auditFilePath(slug: string, date: string): string {
  return path.join(mcpAuditDir(slug), `${date}.json`);
}

function metricsCachePath(slug: string): string {
  return path.join(config.projectsDir, slug, "mcp", "governance-cache.json");
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadAuditEntries(slug: string, date: string): Promise<MCPAuditLog[]> {
  try {
    const data = await readJSON<MCPAuditLog[]>(auditFilePath(slug, date));
    return Array.isArray(data) ? data.map((e) => MCPAuditLogSchema.parse(e)) : [];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) return [];
    throw err;
  }
}

async function saveAuditEntries(slug: string, date: string, entries: MCPAuditLog[]): Promise<void> {
  const dir = mcpAuditDir(slug);
  await ensureDir(dir);
  await writeJSON(auditFilePath(slug, date), entries);
}

async function loadAllAuditEntries(slug: string, fromDate?: string): Promise<MCPAuditLog[]> {
  const dir = mcpAuditDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const all: MCPAuditLog[] = [];
  for (const file of files) {
    const dateStr = file.replace(".json", "");
    if (fromDate && dateStr < fromDate) continue;
    try {
      const data = await readJSON<MCPAuditLog[]>(path.join(dir, file));
      if (Array.isArray(data)) {
        for (const e of data) {
          try {
            all.push(MCPAuditLogSchema.parse(e));
          } catch {
            // skip invalid
          }
        }
      }
    } catch {
      // skip unreadable files
    }
  }
  return all;
}

const METRICS_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function loadCachedMetrics(slug: string): Promise<MCPGovernanceMetrics | null> {
  try {
    const cache = await readJSON<MCPMetricsCache>(metricsCachePath(slug));
    const parsed = MCPMetricsCacheSchema.safeParse(cache);
    if (!parsed.success) return null;
    const age = Date.now() - new Date(parsed.data.cached_at).getTime();
    if (age < METRICS_TTL_MS) return parsed.data.metrics;
    return null;
  } catch {
    return null;
  }
}

async function saveCachedMetrics(slug: string, metrics: MCPGovernanceMetrics): Promise<void> {
  const cache: MCPMetricsCache = MCPMetricsCacheSchema.parse({
    metrics,
    cached_at: new Date().toISOString(),
  });
  await writeJSON(metricsCachePath(slug), cache);
}

function computeGovernanceMetrics(entries: MCPAuditLog[]): MCPGovernanceMetrics {
  const total_calls = entries.length;
  const total_cost_usd = entries.reduce((sum, e) => sum + (e.cost_usd ?? 0), 0);
  const error_count = entries.filter((e) => e.status === "error" || e.status === "timeout").length;
  const denied_calls = entries.filter((e) => e.status === "denied").length;
  const error_rate = total_calls > 0 ? error_count / total_calls : 0;

  // by_server
  const serverMap = new Map<
    string,
    { server_name: string; calls: number; cost: number; errors: number; latency_sum: number }
  >();
  for (const e of entries) {
    const key = e.server_id;
    const cur = serverMap.get(key) ?? { server_name: e.server_name, calls: 0, cost: 0, errors: 0, latency_sum: 0 };
    cur.calls++;
    cur.cost += e.cost_usd ?? 0;
    if (e.status === "error" || e.status === "timeout") cur.errors++;
    cur.latency_sum += e.latency_ms;
    serverMap.set(key, cur);
  }
  const by_server = Array.from(serverMap.entries()).map(([server_id, v]) => ({
    server_id,
    server_name: v.server_name,
    calls: v.calls,
    cost_usd: v.cost,
    error_rate: v.calls > 0 ? v.errors / v.calls : 0,
    avg_latency_ms: v.calls > 0 ? v.latency_sum / v.calls : 0,
  }));

  // by_agent
  const agentMap = new Map<string, { calls: number; cost: number; servers: Set<string> }>();
  for (const e of entries) {
    const cur = agentMap.get(e.agent_type) ?? { calls: 0, cost: 0, servers: new Set() };
    cur.calls++;
    cur.cost += e.cost_usd ?? 0;
    cur.servers.add(e.server_name);
    agentMap.set(e.agent_type, cur);
  }
  const by_agent = Array.from(agentMap.entries()).map(([agent_type, v]) => ({
    agent_type,
    calls: v.calls,
    cost_usd: v.cost,
    servers_used: Array.from(v.servers),
  }));

  // top_tools
  const toolMap = new Map<string, { server_name: string; calls: number; cost: number }>();
  for (const e of entries) {
    const key = `${e.tool_name}::${e.server_name}`;
    const cur = toolMap.get(key) ?? { server_name: e.server_name, calls: 0, cost: 0 };
    cur.calls++;
    cur.cost += e.cost_usd ?? 0;
    toolMap.set(key, cur);
  }
  const top_tools = Array.from(toolMap.entries())
    .map(([key, v]) => ({
      tool_name: key.split("::")[0] ?? key,
      server_name: v.server_name,
      calls: v.calls,
      cost_usd: v.cost,
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 20);

  return MCPGovernanceMetricsSchema.parse({
    total_calls,
    total_cost_usd,
    error_rate,
    denied_calls,
    by_server,
    by_agent,
    top_tools,
  });
}

// --- Audit Log endpoints ---

// POST /hub/projects/:slug/mcp/audit  (ingest a new audit entry)
mcpServers.post("/hub/projects/:slug/mcp/audit", async (c) => {
  const slug = c.req.param("slug");
  const body = await c.req.json<Record<string, unknown>>();

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const parsed = CreateMCPAuditLogSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, 400);
  }

  const now = new Date().toISOString();
  const date = todayDate();
  const entry: MCPAuditLog = {
    id: crypto.randomUUID(),
    project_id: project.id,
    server_id: parsed.data.server_id,
    server_name: parsed.data.server_name,
    tool_name: parsed.data.tool_name,
    agent_type: parsed.data.agent_type,
    session_id: parsed.data.session_id ?? null,
    feature_id: parsed.data.feature_id ?? null,
    status: parsed.data.status,
    latency_ms: parsed.data.latency_ms,
    cost_usd: parsed.data.cost_usd ?? null,
    input_summary: parsed.data.input_summary ?? null,
    output_summary: parsed.data.output_summary ?? null,
    error_message: parsed.data.error_message ?? null,
    timestamp: now,
  };

  const existing = await loadAuditEntries(slug, date);
  existing.push(entry);
  await saveAuditEntries(slug, date, existing);

  return c.json({ entry }, 201);
});

// GET /hub/projects/:slug/mcp/audit
mcpServers.get("/hub/projects/:slug/mcp/audit", async (c) => {
  const slug = c.req.param("slug");
  const { server_id, agent_type, status, from, limit } = c.req.query() as Record<string, string | undefined>;

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let entries = await loadAllAuditEntries(slug, from);

  if (server_id) entries = entries.filter((e) => e.server_id === server_id);
  if (agent_type) entries = entries.filter((e) => e.agent_type === agent_type);
  if (status) entries = entries.filter((e) => e.status === status);

  // Sort newest first
  entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const limitNum = limit ? Math.min(parseInt(limit, 10) || 100, 1000) : 100;
  entries = entries.slice(0, limitNum);

  return c.json({ entries });
});

// GET /hub/projects/:slug/mcp/metrics
mcpServers.get("/hub/projects/:slug/mcp/metrics", async (c) => {
  const slug = c.req.param("slug");
  const { from, to } = c.req.query() as Record<string, string | undefined>;

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Use cache only when no date filter is applied
  if (!from && !to) {
    const cached = await loadCachedMetrics(slug);
    if (cached) return c.json(cached);
  }

  let entries = await loadAllAuditEntries(slug, from);
  if (to) entries = entries.filter((e) => e.timestamp.slice(0, 10) <= to);

  const metrics = computeGovernanceMetrics(entries);

  if (!from && !to) {
    await saveCachedMetrics(slug, metrics);
  }

  return c.json(metrics);
});

export { mcpServers };

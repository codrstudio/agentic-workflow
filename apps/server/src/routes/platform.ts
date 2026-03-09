import { Hono } from "hono";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  PlatformCapabilitySchema,
  TrackUsageBodySchema,
  type PlatformCapability,
  type UsageDayFile,
  type ConsolidationMetrics,
} from "../schemas/platform.js";
import { type Project } from "../schemas/project.js";

const platform = new Hono();

// --- Static catalog of 8 platform capabilities ---
const STATIC_CAPABILITIES: PlatformCapability[] = [
  {
    id: "pm",
    name: "Project Management",
    description: "Gerenciamento de projetos, features, sprints e backlog com IA integrada.",
    status: "active",
    module_route: "/projects",
    features_count: 12,
    replaces: ["Jira", "Linear", "Trello"],
    estimated_monthly_cost_usd: 45,
  },
  {
    id: "sdd",
    name: "Spec-Driven Development",
    description: "Derivação automática de specs e PRPs a partir de pain-gain analysis.",
    status: "active",
    module_route: "/specs",
    features_count: 8,
    replaces: ["Notion", "Confluence"],
    estimated_monthly_cost_usd: 20,
  },
  {
    id: "review",
    name: "AI Code Review",
    description: "Revisão de código automatizada por agentes de IA com feedback estruturado.",
    status: "active",
    module_route: "/reviews",
    features_count: 10,
    replaces: ["GitHub Copilot", "CodeClimate"],
    estimated_monthly_cost_usd: 39,
  },
  {
    id: "security",
    name: "Security Pipeline",
    description: "Pipeline de segurança com scanning, findings e containment policies.",
    status: "active",
    module_route: "/security",
    features_count: 9,
    replaces: ["Snyk", "SonarQube"],
    estimated_monthly_cost_usd: 60,
  },
  {
    id: "context",
    name: "Context Engineering",
    description: "Gerenciamento de contexto, perfis e snapshots para agentes de IA.",
    status: "active",
    module_route: "/context",
    features_count: 7,
    replaces: ["Custom context management", "Prompt libraries"],
    estimated_monthly_cost_usd: 15,
  },
  {
    id: "metrics",
    name: "AI ROI & Metrics",
    description: "Métricas de ROI, throughput, qualidade e uso de tokens.",
    status: "active",
    module_route: "/metrics",
    features_count: 11,
    replaces: ["Tableau", "Mixpanel"],
    estimated_monthly_cost_usd: 50,
  },
  {
    id: "compliance",
    name: "Compliance & Governance",
    description: "ACRs, containment policies, drift events e compliance checks.",
    status: "preview",
    module_route: "/compliance",
    features_count: 6,
    replaces: ["ServiceNow", "Custom audit tools"],
    estimated_monthly_cost_usd: 80,
  },
  {
    id: "mcp",
    name: "MCP Server Management",
    description: "Gestão de MCP servers, model routing e configuração de agentes.",
    status: "preview",
    module_route: "/mcp",
    features_count: 5,
    replaces: ["Custom MCP setups", "Agent frameworks"],
    estimated_monthly_cost_usd: 25,
  },
];

// --- Cache for capabilities (24h TTL) ---
let capabilitiesCache: { data: PlatformCapability[]; expiresAt: number } | null = null;

// --- Cache for consolidation metrics (1h TTL per project) ---
const metricsCache = new Map<string, { data: ConsolidationMetrics; expiresAt: number }>();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(path.join(projectDir(slug), "project.json"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function platformCapabilitiesPath(slug: string): string {
  return path.join(projectDir(slug), "platform-capabilities.json");
}

function consolidationUsageDirPath(slug: string): string {
  return path.join(projectDir(slug), "consolidation-usage");
}

function consolidationUsageDayPath(slug: string, date: string): string {
  return path.join(consolidationUsageDirPath(slug), `${date}.json`);
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadCapabilities(slug: string): Promise<PlatformCapability[]> {
  try {
    const stored = await readJSON<PlatformCapability[]>(platformCapabilitiesPath(slug));
    if (Array.isArray(stored) && stored.length > 0) return stored;
  } catch {
    // Fall through to static catalog
  }
  return STATIC_CAPABILITIES;
}

async function loadUsageForDay(slug: string, date: string): Promise<UsageDayFile> {
  try {
    return await readJSON<UsageDayFile>(consolidationUsageDayPath(slug, date));
  } catch {
    return [];
  }
}

async function computeConsolidationMetrics(slug: string): Promise<ConsolidationMetrics> {
  const capabilities = await loadCapabilities(slug);

  const activeCapabilities = capabilities.filter((c) => c.status === "active");
  const capabilitiesActive = activeCapabilities.length;
  const capabilitiesTotal = capabilities.length;
  const adoptionRate = capabilitiesTotal > 0 ? capabilitiesActive / capabilitiesTotal : 0;

  // Build tools_replaced list from active capabilities
  const toolsReplaced = activeCapabilities.flatMap((cap) =>
    cap.replaces.map((toolName) => ({
      tool_name: toolName,
      monthly_cost: cap.estimated_monthly_cost_usd / cap.replaces.length,
      capability_id: cap.id,
    }))
  );

  const estimatedMonthlySavingsUsd = activeCapabilities.reduce(
    (sum, cap) => sum + cap.estimated_monthly_cost_usd,
    0
  );
  const estimatedAnnualSavingsUsd = estimatedMonthlySavingsUsd * 12;

  // Load today's usage events
  const today = todayDate();
  const todayEvents = await loadUsageForDay(slug, today);

  const modulesUsedToday = new Set(todayEvents.map((e) => e.module)).size;

  // Compute cross-module actions for today
  const crossModuleMap = new Map<string, number>();
  for (let i = 1; i < todayEvents.length; i++) {
    const prev = todayEvents[i - 1]!;
    const curr = todayEvents[i]!;
    if (prev.module !== curr.module) {
      const key = `${prev.module}→${curr.module}`;
      crossModuleMap.set(key, (crossModuleMap.get(key) ?? 0) + 1);
    }
  }

  const crossModuleActions = Array.from(crossModuleMap.entries()).map(([key, count]) => {
    const [from_module, to_module] = key.split("→") as [string, string];
    return { from_module, to_module, count };
  });

  // Compute avg_module_switches_per_day over last 7 days
  const now = new Date();
  let totalSwitches = 0;
  let daysWithData = 0;
  for (let d = 0; d < 7; d++) {
    const date = new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const events = await loadUsageForDay(slug, date);
    if (events.length > 0) {
      daysWithData++;
      let switches = 0;
      for (let i = 1; i < events.length; i++) {
        if (events[i - 1]!.module !== events[i]!.module) switches++;
      }
      totalSwitches += switches;
    }
  }
  const avgModuleSwitchesPerDay = daysWithData > 0 ? totalSwitches / daysWithData : 0;

  return {
    capabilities_active: capabilitiesActive,
    capabilities_total: capabilitiesTotal,
    adoption_rate: Math.round(adoptionRate * 1000) / 1000,
    tools_replaced: toolsReplaced,
    estimated_monthly_savings_usd: Math.round(estimatedMonthlySavingsUsd * 100) / 100,
    estimated_annual_savings_usd: Math.round(estimatedAnnualSavingsUsd * 100) / 100,
    modules_used_today: modulesUsedToday,
    avg_module_switches_per_day: Math.round(avgModuleSwitchesPerDay * 100) / 100,
    cross_module_actions: crossModuleActions,
  };
}

// GET /hub/platform/capabilities
platform.get("/hub/platform/capabilities", async (c) => {
  const now = Date.now();
  if (capabilitiesCache && capabilitiesCache.expiresAt > now) {
    return c.json(capabilitiesCache.data);
  }

  const capabilities = STATIC_CAPABILITIES.map((cap) =>
    PlatformCapabilitySchema.parse(cap)
  );

  capabilitiesCache = { data: capabilities, expiresAt: now + 24 * 60 * 60 * 1000 };
  return c.json(capabilities);
});

// GET /hub/projects/:projectId/consolidation/metrics
platform.get("/hub/projects/:projectId/consolidation/metrics", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const now = Date.now();
  const cached = metricsCache.get(slug);
  if (cached && cached.expiresAt > now) {
    return c.json(cached.data);
  }

  const metrics = await computeConsolidationMetrics(slug);
  metricsCache.set(slug, { data: metrics, expiresAt: now + 60 * 60 * 1000 });

  return c.json(metrics);
});

// POST /hub/projects/:projectId/consolidation/track
platform.post("/hub/projects/:projectId/consolidation/track", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = TrackUsageBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const today = todayDate();
  const event = {
    module: parsed.data.module,
    action: parsed.data.action,
    timestamp: new Date().toISOString(),
  };

  // Load existing events for today and append
  const existing = await loadUsageForDay(slug, today);
  existing.push(event);

  await ensureDir(consolidationUsageDirPath(slug));
  await writeJSON(consolidationUsageDayPath(slug, today), existing);

  // Invalidate metrics cache for this project
  metricsCache.delete(slug);

  return c.json(event, 201);
});

export { platform };

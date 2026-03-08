import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  SecurityGateConfigSchema,
  PutSecurityGateConfigBody,
  SecurityScanSchema,
  CreateSecurityScanBody,
  type SecurityGateConfig,
  type SecurityScan,
} from "../schemas/security.js";
import { type Project } from "../schemas/project.js";

const security = new Hono();

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

function gateConfigPath(slug: string): string {
  return path.join(projectDir(slug), "security-gate-config.json");
}

function scansDirPath(slug: string): string {
  return path.join(projectDir(slug), "security-scans");
}

function scanPath(slug: string, id: string): string {
  return path.join(scansDirPath(slug), `${id}.json`);
}

async function loadGateConfig(slug: string, projectId: string): Promise<SecurityGateConfig> {
  try {
    return await readJSON<SecurityGateConfig>(gateConfigPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      // Return defaults
      return {
        project_id: projectId,
        enabled: true,
        block_on_critical: true,
        block_on_high: true,
        block_on_medium: false,
        auto_scan_on_review: true,
        scan_model: "claude-sonnet-4-5-20250514",
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

async function loadAllScans(slug: string): Promise<SecurityScan[]> {
  const dir = scansDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const scans: SecurityScan[] = [];
  for (const file of files) {
    try {
      const s = await readJSON<SecurityScan>(path.join(dir, file));
      scans.push(s);
    } catch {
      // skip malformed
    }
  }
  return scans;
}

// GET /hub/projects/:slug/security/gate-config
security.get("/hub/projects/:slug/security/gate-config", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const cfg = await loadGateConfig(slug, project.id);
  return c.json(cfg);
});

// PUT /hub/projects/:slug/security/gate-config
security.put("/hub/projects/:slug/security/gate-config", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PutSecurityGateConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const existing = await loadGateConfig(slug, project.id);
  const updated: SecurityGateConfig = {
    ...existing,
    ...parsed.data,
    project_id: project.id,
    updated_at: new Date().toISOString(),
  };

  const validated = SecurityGateConfigSchema.safeParse(updated);
  if (!validated.success) {
    return c.json({ error: "Config construction failed", details: validated.error.issues }, 500);
  }

  await writeJSON(gateConfigPath(slug), validated.data);
  return c.json(validated.data);
});

// GET /hub/projects/:slug/security/scans
security.get("/hub/projects/:slug/security/scans", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let scans = await loadAllScans(slug);

  const featureId = c.req.query("feature_id");
  const scanType = c.req.query("scan_type");
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 50;

  if (featureId) {
    scans = scans.filter((s) => s.feature_id === featureId);
  }
  if (scanType) {
    scans = scans.filter((s) => s.scan_type === scanType);
  }

  // Sort by started_at desc
  scans.sort((a, b) => b.started_at.localeCompare(a.started_at));

  return c.json(scans.slice(0, limit));
});

// POST /hub/projects/:slug/security/scans
security.post("/hub/projects/:slug/security/scans", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateSecurityScanBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const data = parsed.data;

  const scan: SecurityScan = {
    id,
    project_id: project.id,
    feature_id: data.feature_id ?? null,
    scan_type: data.scan_type,
    status: "pending",
    findings_count: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    },
    triggered_by: data.triggered_by,
    started_at: now,
    completed_at: null,
  };

  const validated = SecurityScanSchema.safeParse(scan);
  if (!validated.success) {
    return c.json({ error: "Scan construction failed", details: validated.error.issues }, 500);
  }

  await ensureDir(scansDirPath(slug));
  await writeJSON(scanPath(slug, id), validated.data);

  return c.json(validated.data, 201);
});

export { security };

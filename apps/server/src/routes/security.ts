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
  SecurityFindingSchema,
  CreateSecurityFindingBody,
  PatchSecurityFindingBody,
  GateCheckBody,
  type SecurityGateConfig,
  type SecurityScan,
  type SecurityFinding,
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

function findingsDirPath(slug: string): string {
  return path.join(projectDir(slug), "security-findings");
}

function findingPath(slug: string, id: string): string {
  return path.join(findingsDirPath(slug), `${id}.json`);
}

async function loadAllFindings(slug: string): Promise<SecurityFinding[]> {
  const dir = findingsDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const findings: SecurityFinding[] = [];
  for (const file of files) {
    try {
      const f = await readJSON<SecurityFinding>(path.join(dir, file));
      findings.push(f);
    } catch {
      // skip malformed
    }
  }
  return findings;
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

// POST /hub/projects/:slug/security/findings
security.post("/hub/projects/:slug/security/findings", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateSecurityFindingBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const data = parsed.data;

  const finding: SecurityFinding = {
    id,
    project_id: project.id,
    scan_id: data.scan_id,
    feature_id: data.feature_id ?? null,
    severity: data.severity,
    category: data.category,
    title: data.title,
    description: data.description,
    file_path: data.file_path ?? null,
    line_number: data.line_number ?? null,
    suggested_fix: data.suggested_fix ?? null,
    resolution: "open",
    resolution_note: null,
    resolved_at: null,
    created_at: now,
  };

  const validated = SecurityFindingSchema.safeParse(finding);
  if (!validated.success) {
    return c.json({ error: "Finding construction failed", details: validated.error.issues }, 500);
  }

  await ensureDir(findingsDirPath(slug));
  await writeJSON(findingPath(slug, id), validated.data);

  return c.json(validated.data, 201);
});

// GET /hub/projects/:slug/security/findings
security.get("/hub/projects/:slug/security/findings", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let findings = await loadAllFindings(slug);

  const scanId = c.req.query("scan_id");
  const featureId = c.req.query("feature_id");
  const severity = c.req.query("severity");
  const resolution = c.req.query("resolution");
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 100;

  if (scanId) findings = findings.filter((f) => f.scan_id === scanId);
  if (featureId) findings = findings.filter((f) => f.feature_id === featureId);
  if (severity) findings = findings.filter((f) => f.severity === severity);
  if (resolution) findings = findings.filter((f) => f.resolution === resolution);

  return c.json(findings.slice(0, limit));
});

// PATCH /hub/projects/:slug/security/findings/:findingId
security.patch("/hub/projects/:slug/security/findings/:findingId", async (c) => {
  const slug = c.req.param("slug");
  const findingId = c.req.param("findingId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchSecurityFindingBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  let existing: SecurityFinding;
  try {
    existing = await readJSON<SecurityFinding>(findingPath(slug, findingId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "Finding not found" }, 404);
    }
    throw err;
  }

  const now = new Date().toISOString();
  const newResolution = parsed.data.resolution ?? existing.resolution;
  const resolvedStatuses = ["fixed", "accepted_risk", "false_positive"];
  const wasOpen = existing.resolution === "open";
  const isNowResolved = resolvedStatuses.includes(newResolution);

  const updated: SecurityFinding = {
    ...existing,
    resolution: newResolution,
    resolution_note: parsed.data.resolution_note !== undefined ? parsed.data.resolution_note : existing.resolution_note,
    resolved_at: wasOpen && isNowResolved ? now : existing.resolved_at,
  };

  const validated = SecurityFindingSchema.safeParse(updated);
  if (!validated.success) {
    return c.json({ error: "Finding construction failed", details: validated.error.issues }, 500);
  }

  await writeJSON(findingPath(slug, findingId), validated.data);
  return c.json(validated.data);
});

// GET /hub/projects/:slug/security/scorecard
security.get("/hub/projects/:slug/security/scorecard", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const allFindings = await loadAllFindings(slug);
  const openFindings = allFindings.filter((f) => f.resolution === "open");

  const counts = {
    critical: openFindings.filter((f) => f.severity === "critical").length,
    high: openFindings.filter((f) => f.severity === "high").length,
    medium: openFindings.filter((f) => f.severity === "medium").length,
    low: openFindings.filter((f) => f.severity === "low").length,
    info: openFindings.filter((f) => f.severity === "info").length,
  };

  const score = Math.max(
    0,
    100 - (counts.critical * 25 + counts.high * 10 + counts.medium * 3 + counts.low * 1)
  );

  const resolvedFindings = allFindings.filter((f) => f.resolved_at != null);
  let avg_resolution_hours: number | null = null;
  if (resolvedFindings.length > 0) {
    const totalMs = resolvedFindings.reduce((sum, f) => {
      const created = new Date(f.created_at).getTime();
      const resolved = new Date(f.resolved_at!).getTime();
      return sum + (resolved - created);
    }, 0);
    avg_resolution_hours = Math.round((totalMs / resolvedFindings.length / 3600000) * 10) / 10;
  }

  // Weekly findings: group open findings by week (last 8 weeks)
  const now = new Date();
  const weeks: Array<{
    week: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  }> = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 3600000);
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600000);
    const label = `W${weekStart.toISOString().slice(5, 7)}/${weekStart.toISOString().slice(8, 10)}`;
    const weekFindings = allFindings.filter((f) => {
      const created = new Date(f.created_at).getTime();
      return created >= weekStart.getTime() && created < weekEnd.getTime();
    });
    weeks.push({
      week: label,
      critical: weekFindings.filter((f) => f.severity === "critical").length,
      high: weekFindings.filter((f) => f.severity === "high").length,
      medium: weekFindings.filter((f) => f.severity === "medium").length,
      low: weekFindings.filter((f) => f.severity === "low").length,
      info: weekFindings.filter((f) => f.severity === "info").length,
    });
  }

  return c.json({
    score,
    open_count: openFindings.length,
    critical_high_count: counts.critical + counts.high,
    avg_resolution_hours,
    counts,
    weekly_findings: weeks,
    open_critical_high: openFindings
      .filter((f) => f.severity === "critical" || f.severity === "high")
      .sort((a, b) => {
        const sev = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return sev[a.severity] - sev[b.severity];
      }),
  });
});

// POST /hub/projects/:slug/security/gate-check
security.post("/hub/projects/:slug/security/gate-check", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = GateCheckBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const cfg = await loadGateConfig(slug, project.id);
  const allFindings = await loadAllFindings(slug);

  // Get open findings for this feature
  const openFindings = allFindings.filter(
    (f) => f.feature_id === parsed.data.feature_id && f.resolution === "open"
  );

  const blockers: SecurityFinding[] = [];

  if (cfg.block_on_critical) {
    blockers.push(...openFindings.filter((f) => f.severity === "critical"));
  }
  if (cfg.block_on_high) {
    blockers.push(...openFindings.filter((f) => f.severity === "high"));
  }
  if (cfg.block_on_medium) {
    blockers.push(...openFindings.filter((f) => f.severity === "medium"));
  }

  const passed = blockers.length === 0;

  const counts = {
    critical: openFindings.filter((f) => f.severity === "critical").length,
    high: openFindings.filter((f) => f.severity === "high").length,
    medium: openFindings.filter((f) => f.severity === "medium").length,
    low: openFindings.filter((f) => f.severity === "low").length,
    info: openFindings.filter((f) => f.severity === "info").length,
  };

  let summary: string;
  if (passed) {
    if (openFindings.length === 0) {
      summary = `Gate check passed. No open findings for feature ${parsed.data.feature_id}.`;
    } else {
      summary = `Gate check passed. ${openFindings.length} open finding(s) (low/info only) for feature ${parsed.data.feature_id}.`;
    }
  } else {
    const parts: string[] = [];
    if (counts.critical > 0) parts.push(`${counts.critical} critical`);
    if (counts.high > 0) parts.push(`${counts.high} high`);
    if (counts.medium > 0) parts.push(`${counts.medium} medium`);
    summary = `Gate check failed. Blocking finding(s): ${parts.join(", ")} for feature ${parsed.data.feature_id}.`;
  }

  return c.json({ passed, blockers, summary });
});

export { security };

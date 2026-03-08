import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  RescueProjectSchema,
  CreateRescueProjectBody,
  PatchRescueProjectBody,
  CodebaseAuditSchema,
  RescueDifficultyEnum,
  type RescueProject,
  type CodebaseAudit,
} from "../schemas/rescue.js";
import { type Project } from "../schemas/project.js";

const rescue = new Hono();

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

function rescueProjectsDirPath(slug: string): string {
  return path.join(projectDir(slug), "rescue-projects");
}

function rescueProjectPath(slug: string, id: string): string {
  return path.join(rescueProjectsDirPath(slug), `${id}.json`);
}

function rescueAuditsDirPath(slug: string): string {
  return path.join(projectDir(slug), "rescue-audits");
}

function rescueAuditPath(slug: string, rescueId: string): string {
  return path.join(rescueAuditsDirPath(slug), `${rescueId}.json`);
}

async function loadAllRescueProjects(slug: string): Promise<RescueProject[]> {
  const dir = rescueProjectsDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const projects: RescueProject[] = [];
  for (const file of files) {
    try {
      const p = await readJSON<RescueProject>(path.join(dir, file));
      projects.push(p);
    } catch {
      // skip malformed files
    }
  }
  return projects;
}

const PHASE_ORDER = [
  "audit",
  "reverse_spec",
  "gap_analysis",
  "remediation",
  "execution",
  "validation",
] as const;

// GET /hub/projects/:slug/rescue
rescue.get("/hub/projects/:slug/rescue", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const rescueProjects = await loadAllRescueProjects(slug);
  return c.json(rescueProjects);
});

// POST /hub/projects/:slug/rescue
rescue.post("/hub/projects/:slug/rescue", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateRescueProjectBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  const rescueProject: RescueProject = {
    id,
    project_id: project.id,
    name: parsed.data.name,
    source_path: parsed.data.source_path,
    phase: "audit",
    phases_completed: [],
    created_at: now,
    updated_at: now,
  };

  await ensureDir(rescueProjectsDirPath(slug));
  await writeJSON(rescueProjectPath(slug, id), rescueProject);

  return c.json(rescueProject, 201);
});

// GET /hub/projects/:slug/rescue/:rescueId
rescue.get("/hub/projects/:slug/rescue/:rescueId", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let rescueProject: RescueProject;
  try {
    rescueProject = await readJSON<RescueProject>(rescueProjectPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RescueProject not found" }, 404);
    }
    throw err;
  }

  return c.json(rescueProject);
});

// PATCH /hub/projects/:slug/rescue/:rescueId
rescue.patch("/hub/projects/:slug/rescue/:rescueId", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let existing: RescueProject;
  try {
    existing = await readJSON<RescueProject>(rescueProjectPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RescueProject not found" }, 404);
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchRescueProjectBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const data = parsed.data;
  const now = new Date().toISOString();

  let phasesCompleted = [...existing.phases_completed];
  let newPhase = existing.phase;

  if (data.phase && data.phase !== existing.phase) {
    const currentIdx = PHASE_ORDER.indexOf(existing.phase as (typeof PHASE_ORDER)[number]);
    const newIdx = PHASE_ORDER.indexOf(data.phase as (typeof PHASE_ORDER)[number]);
    // Advancing phase: add current phase to phases_completed if not already there
    if (newIdx > currentIdx && !phasesCompleted.includes(existing.phase)) {
      phasesCompleted = [...phasesCompleted, existing.phase];
    }
    newPhase = data.phase;
  }

  const updated: RescueProject = {
    ...existing,
    name: data.name ?? existing.name,
    source_path: data.source_path ?? existing.source_path,
    phase: newPhase,
    phases_completed: phasesCompleted,
    updated_at: now,
  };

  await writeJSON(rescueProjectPath(slug, rescueId), updated);
  return c.json(updated);
});

// POST /hub/projects/:slug/rescue/:rescueId/audit  (202 Accepted, async)
rescue.post("/hub/projects/:slug/rescue/:rescueId/audit", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let rescueProject: RescueProject;
  try {
    rescueProject = await readJSON<RescueProject>(rescueProjectPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RescueProject not found" }, 404);
    }
    throw err;
  }

  // Generate a deterministic audit result (AI simulation)
  const auditId = randomUUID();
  const now = new Date().toISOString();

  const audit: CodebaseAudit = {
    id: auditId,
    rescue_id: rescueId,
    metrics: {
      files: 42,
      lines: 3800,
      languages: ["TypeScript", "JavaScript", "CSS"],
    },
    health: {
      has_tests: false,
      test_coverage_estimate: "low",
      has_ci_cd: false,
      has_documentation: false,
      has_type_safety: true,
      dependency_health: "outdated",
    },
    issues: [
      {
        category: "architecture",
        severity: "high",
        description: "No clear separation of concerns between UI and business logic",
        file_path: null,
      },
      {
        category: "testing",
        severity: "critical",
        description: "No automated tests found in the codebase",
        file_path: null,
      },
      {
        category: "documentation",
        severity: "medium",
        description: "Missing API documentation and inline comments",
        file_path: null,
      },
    ],
    ai_summary:
      "This codebase shows signs of rapid vibe-coded development. Core functionality is present but lacks proper testing, documentation, and architectural boundaries. The estimated rescue effort is significant but achievable with a structured approach.",
    rescue_difficulty: "high",
    estimated_effort_hours: 80,
    created_at: now,
  };

  await ensureDir(rescueAuditsDirPath(slug));
  await writeJSON(rescueAuditPath(slug, rescueId), audit);

  return c.json({ accepted: true, audit_id: auditId, rescue_id: rescueId }, 202);
});

// GET /hub/projects/:slug/rescue/:rescueId/audit
rescue.get("/hub/projects/:slug/rescue/:rescueId/audit", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let audit: CodebaseAudit;
  try {
    audit = await readJSON<CodebaseAudit>(rescueAuditPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "Audit not found" }, 404);
    }
    throw err;
  }

  return c.json(audit);
});

export { rescue };

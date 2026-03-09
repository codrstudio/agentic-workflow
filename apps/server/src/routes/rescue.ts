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
  PatchRemediationBody,
  type RescueProject,
  type CodebaseAudit,
  type ReverseSpec,
  type RemediationPlan,
  type RemediationItem,
} from "../schemas/rescue.js";
import {
  SpecDocumentSchema,
  SpecIndexSchema,
  type SpecDocument,
  type SpecIndex,
} from "../schemas/spec-document.js";
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

// ---- ReverseSpec helpers ----

function reverseSpecsDirPath(slug: string): string {
  return path.join(projectDir(slug), "reverse-specs");
}

function reverseSpecPath(slug: string, id: string): string {
  return path.join(reverseSpecsDirPath(slug), `${id}.json`);
}

async function loadAllReverseSpecs(slug: string, rescueId: string): Promise<ReverseSpec[]> {
  const dir = reverseSpecsDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const result: ReverseSpec[] = [];
  for (const file of files) {
    try {
      const rs = await readJSON<ReverseSpec>(path.join(dir, file));
      if (rs.rescue_id === rescueId) result.push(rs);
    } catch {
      // skip malformed
    }
  }
  return result;
}

// Spec index helpers (for promote)
function specIndexPath(slug: string): string {
  return path.join(projectDir(slug), "spec-index.json");
}

function specsDirPath(slug: string): string {
  return path.join(projectDir(slug), "specs");
}

function specFilePath(slug: string, id: string): string {
  return path.join(specsDirPath(slug), `${id}.json`);
}

async function loadSpecIndex(slug: string): Promise<SpecIndex> {
  try {
    return await readJSON<SpecIndex>(specIndexPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return { slugs: [], next_number: 1 };
    }
    throw err;
  }
}

// Deterministic module list for reverse spec generation
const SAMPLE_MODULES = [
  {
    module_name: "AuthModule",
    file_paths: ["src/auth/index.ts", "src/auth/middleware.ts"],
    inferred_purpose: "Handles user authentication and session management",
    current_behavior:
      "Implements JWT-based auth with hardcoded secrets and no token refresh logic",
    issues_found: [
      { description: "Hardcoded JWT secret in source code", severity: "critical" as const },
      { description: "No token refresh mechanism", severity: "high" as const },
    ],
    recommended_changes: [
      "Move JWT secret to environment variables",
      "Implement token refresh flow",
      "Add rate limiting to auth endpoints",
    ],
  },
  {
    module_name: "DataLayer",
    file_paths: ["src/db/client.ts", "src/db/queries.ts", "src/models/"],
    inferred_purpose: "Database access layer for CRUD operations",
    current_behavior:
      "Direct SQL queries mixed with business logic, no ORM, no connection pooling",
    issues_found: [
      { description: "SQL queries mixed with business logic", severity: "high" as const },
      { description: "No connection pooling configured", severity: "medium" as const },
      { description: "Missing input sanitization on raw queries", severity: "high" as const },
    ],
    recommended_changes: [
      "Extract data access into repository pattern",
      "Configure connection pooling",
      "Add input validation layer",
    ],
  },
  {
    module_name: "APIRouter",
    file_paths: ["src/routes/", "src/middleware/"],
    inferred_purpose: "HTTP routing and request handling",
    current_behavior: "Monolithic router file with all endpoints, no modular separation",
    issues_found: [
      { description: "Single 800-line router file", severity: "medium" as const },
      { description: "No request validation on most endpoints", severity: "high" as const },
    ],
    recommended_changes: [
      "Split router into domain-specific modules",
      "Add Zod schema validation for all request bodies",
      "Implement consistent error response format",
    ],
  },
];

// POST /hub/projects/:slug/rescue/:rescueId/reverse-specs  (202 Accepted, async trigger)
rescue.post("/hub/projects/:slug/rescue/:rescueId/reverse-specs", async (c) => {
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

  // Generate deterministic reverse-specs for each module
  await ensureDir(reverseSpecsDirPath(slug));
  const now = new Date().toISOString();
  const createdIds: string[] = [];

  for (const mod of SAMPLE_MODULES) {
    const id = randomUUID();
    const rs: ReverseSpec = {
      id,
      rescue_id: rescueId,
      module_name: mod.module_name,
      file_paths: mod.file_paths,
      inferred_purpose: mod.inferred_purpose,
      current_behavior: mod.current_behavior,
      issues_found: mod.issues_found,
      recommended_changes: mod.recommended_changes,
      promoted_to_spec_id: null,
      created_at: now,
    };
    await writeJSON(reverseSpecPath(slug, id), rs);
    createdIds.push(id);
  }

  return c.json(
    { accepted: true, rescue_id: rescueId, reverse_specs_queued: createdIds.length },
    202
  );
});

// GET /hub/projects/:slug/rescue/:rescueId/reverse-specs
rescue.get("/hub/projects/:slug/rescue/:rescueId/reverse-specs", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Verify rescue project exists
  try {
    await readJSON<RescueProject>(rescueProjectPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RescueProject not found" }, 404);
    }
    throw err;
  }

  const reverseSpecs = await loadAllReverseSpecs(slug, rescueId);
  return c.json(reverseSpecs);
});

// POST /hub/projects/:slug/rescue/:rescueId/reverse-specs/:reverseSpecId/promote
rescue.post(
  "/hub/projects/:slug/rescue/:rescueId/reverse-specs/:reverseSpecId/promote",
  async (c) => {
    const slug = c.req.param("slug");
    const rescueId = c.req.param("rescueId");
    const reverseSpecId = c.req.param("reverseSpecId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    // Load reverse spec
    let rs: ReverseSpec;
    try {
      rs = await readJSON<ReverseSpec>(reverseSpecPath(slug, reverseSpecId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found") || msg.includes("ENOENT")) {
        return c.json({ error: "ReverseSpec not found" }, 404);
      }
      throw err;
    }

    if (rs.rescue_id !== rescueId) {
      return c.json({ error: "ReverseSpec does not belong to this rescue project" }, 400);
    }

    if (rs.promoted_to_spec_id !== null) {
      return c.json({ error: "ReverseSpec already promoted" }, 409);
    }

    // Create SpecDocument from reverse-spec
    const specIndex = await loadSpecIndex(slug);
    const num = specIndex.next_number;
    const specSlug = `S-${String(num).padStart(3, "0")}`;
    const now = new Date().toISOString();
    const specId = randomUUID();

    const contentMd = [
      `## Inferred Purpose\n\n${rs.inferred_purpose}`,
      `## Current Behavior\n\n${rs.current_behavior}`,
      `## Recommended Changes\n\n${rs.recommended_changes.map((c) => `- ${c}`).join("\n")}`,
      `## Files\n\n${rs.file_paths.map((f) => `- \`${f}\``).join("\n")}`,
    ].join("\n\n");

    const doc: SpecDocument = SpecDocumentSchema.parse({
      id: specId,
      project_id: project.id,
      slug: specSlug,
      title: rs.module_name,
      status: "draft",
      version: 1,
      content_md: contentMd,
      sections: [],
      discoveries: [],
      derived_features: [],
      review_score: null,
      reviewed_by: [],
      superseded_by: null,
      tags: ["rescue", "reverse-spec"],
      created_at: now,
      updated_at: now,
    });

    await ensureDir(specsDirPath(slug));
    await writeJSON(specFilePath(slug, specId), doc);

    const updatedIndex: SpecIndex = {
      slugs: [...specIndex.slugs, specSlug],
      next_number: num + 1,
    };
    await writeJSON(specIndexPath(slug), updatedIndex);

    // Mark reverse-spec as promoted
    const updatedRs: ReverseSpec = { ...rs, promoted_to_spec_id: specId };
    await writeJSON(reverseSpecPath(slug, reverseSpecId), updatedRs);

    return c.json({ reverse_spec: updatedRs, spec: doc }, 201);
  }
);

// ---- RemediationPlan helpers ----

function remediationPlansDirPath(slug: string): string {
  return path.join(projectDir(slug), "remediation-plans");
}

function remediationPlanPath(slug: string, rescueId: string): string {
  return path.join(remediationPlansDirPath(slug), `${rescueId}.json`);
}

function featuresJsonPath(slug: string): string {
  return path.join(projectDir(slug), "features.json");
}

function computeTotalEffort(items: RemediationItem[]): string {
  const effortWeights: Record<string, number> = { small: 1, medium: 3, large: 5, xlarge: 10 };
  const total = items.reduce((sum, item) => sum + (effortWeights[item.effort_estimate] ?? 3), 0);
  if (total <= 5) return "small";
  if (total <= 15) return "medium";
  if (total <= 30) return "large";
  return "xlarge";
}

// Deterministic remediation plan items based on common audit findings
const REMEDIATION_ITEMS_TEMPLATE: Omit<RemediationItem, "id">[] = [
  {
    priority: 1,
    category: "security",
    title: "Fix hardcoded secrets and credentials",
    description:
      "Remove hardcoded JWT secrets, API keys, and credentials from source code. Move to environment variables and secrets management.",
    effort_estimate: "small",
    status: "pending",
    feature_id: null,
  },
  {
    priority: 2,
    category: "testing",
    title: "Establish test suite foundation",
    description:
      "Set up testing framework (Jest/Vitest), write unit tests for core business logic, achieve minimum 60% coverage.",
    effort_estimate: "large",
    status: "pending",
    feature_id: null,
  },
  {
    priority: 3,
    category: "architecture",
    title: "Separate concerns with layered architecture",
    description:
      "Introduce service layer between routes and data access. Extract business logic from controllers. Apply repository pattern for data access.",
    effort_estimate: "xlarge",
    status: "pending",
    feature_id: null,
  },
  {
    priority: 4,
    category: "types",
    title: "Add TypeScript strict mode and Zod validation",
    description:
      "Enable strict TypeScript mode. Add Zod schemas for all API request/response bodies. Eliminate implicit any types.",
    effort_estimate: "medium",
    status: "pending",
    feature_id: null,
  },
  {
    priority: 5,
    category: "documentation",
    title: "Document APIs and architecture decisions",
    description:
      "Add OpenAPI/Swagger documentation for all endpoints. Write architecture decision records (ADRs). Document setup and deployment procedures.",
    effort_estimate: "medium",
    status: "pending",
    feature_id: null,
  },
  {
    priority: 6,
    category: "performance",
    title: "Configure database connection pooling",
    description:
      "Add connection pooling to database client. Configure pool size based on expected load. Add query timeout handling.",
    effort_estimate: "small",
    status: "pending",
    feature_id: null,
  },
];

// POST /hub/projects/:slug/rescue/:rescueId/remediation  (202 Accepted, async)
rescue.post("/hub/projects/:slug/rescue/:rescueId/remediation", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  try {
    await readJSON<RescueProject>(rescueProjectPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RescueProject not found" }, 404);
    }
    throw err;
  }

  const planId = randomUUID();
  const now = new Date().toISOString();

  const items: RemediationItem[] = REMEDIATION_ITEMS_TEMPLATE.map((tpl) => ({
    ...tpl,
    id: randomUUID(),
  }));

  const plan: RemediationPlan = {
    id: planId,
    rescue_id: rescueId,
    items,
    total_effort_estimate: computeTotalEffort(items),
    created_at: now,
    updated_at: now,
  };

  await ensureDir(remediationPlansDirPath(slug));
  await writeJSON(remediationPlanPath(slug, rescueId), plan);

  return c.json({ accepted: true, plan_id: planId, rescue_id: rescueId, items_count: items.length }, 202);
});

// GET /hub/projects/:slug/rescue/:rescueId/remediation
rescue.get("/hub/projects/:slug/rescue/:rescueId/remediation", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let plan: RemediationPlan;
  try {
    plan = await readJSON<RemediationPlan>(remediationPlanPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RemediationPlan not found" }, 404);
    }
    throw err;
  }

  const sorted = { ...plan, items: [...plan.items].sort((a, b) => a.priority - b.priority) };
  return c.json(sorted);
});

// PATCH /hub/projects/:slug/rescue/:rescueId/remediation
rescue.patch("/hub/projects/:slug/rescue/:rescueId/remediation", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let plan: RemediationPlan;
  try {
    plan = await readJSON<RemediationPlan>(remediationPlanPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RemediationPlan not found" }, 404);
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchRemediationBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const now = new Date().toISOString();
  let items = [...plan.items];

  if (parsed.data.items) {
    for (const patch of parsed.data.items) {
      const idx = items.findIndex((item) => item.id === patch.id);
      if (idx === -1) continue;
      const item = items[idx]!;
      items[idx] = {
        ...item,
        priority: patch.priority ?? item.priority,
        status: patch.status ?? item.status,
        feature_id: patch.feature_id !== undefined ? patch.feature_id : item.feature_id,
      };
    }
  }

  const updated: RemediationPlan = {
    ...plan,
    items,
    total_effort_estimate: computeTotalEffort(items),
    updated_at: now,
  };

  await writeJSON(remediationPlanPath(slug, rescueId), updated);
  const sorted = { ...updated, items: [...updated.items].sort((a, b) => a.priority - b.priority) };
  return c.json(sorted);
});

// POST /hub/projects/:slug/rescue/:rescueId/remediation/generate-features
rescue.post("/hub/projects/:slug/rescue/:rescueId/remediation/generate-features", async (c) => {
  const slug = c.req.param("slug");
  const rescueId = c.req.param("rescueId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let plan: RemediationPlan;
  try {
    plan = await readJSON<RemediationPlan>(remediationPlanPath(slug, rescueId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "RemediationPlan not found" }, 404);
    }
    throw err;
  }

  // Load existing features.json (if it exists)
  let existingFeatures: Array<Record<string, unknown>> = [];
  try {
    existingFeatures = await readJSON<Array<Record<string, unknown>>>(featuresJsonPath(slug));
  } catch {
    existingFeatures = [];
  }

  // Compute next feature ID number
  const existingIds = existingFeatures
    .map((f) => {
      const id = typeof f.id === "string" ? f.id : "";
      const m = id.match(/^F-(\d+)$/);
      return m ? parseInt(m[1]!, 10) : 0;
    })
    .filter((n) => n > 0);
  let nextNum = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;

  // Convert pending items to features
  const pendingItems = plan.items.filter((item) => item.status === "pending");
  const newFeatures: Array<Record<string, unknown>> = [];
  const updatedItems = [...plan.items];

  for (const item of pendingItems) {
    const featureId = `F-${String(nextNum).padStart(3, "0")}`;
    nextNum++;

    newFeatures.push({
      id: featureId,
      name: item.title,
      description: item.description,
      status: "pending",
      priority: item.priority,
      category: item.category,
      effort_estimate: item.effort_estimate,
      source: "remediation",
      rescue_id: rescueId,
    });

    // Update item with feature_id
    const idx = updatedItems.findIndex((i) => i.id === item.id);
    if (idx !== -1) {
      updatedItems[idx] = { ...updatedItems[idx]!, feature_id: featureId };
    }
  }

  // Save updated features.json
  const allFeatures = [...existingFeatures, ...newFeatures];
  await writeJSON(featuresJsonPath(slug), allFeatures);

  // Update remediation plan with feature_ids
  const now = new Date().toISOString();
  const updatedPlan: RemediationPlan = {
    ...plan,
    items: updatedItems,
    updated_at: now,
  };
  await writeJSON(remediationPlanPath(slug, rescueId), updatedPlan);

  return c.json({
    features_created: newFeatures.length,
    feature_ids: newFeatures.map((f) => f.id),
    plan: updatedPlan,
  }, 201);
});

export { rescue };

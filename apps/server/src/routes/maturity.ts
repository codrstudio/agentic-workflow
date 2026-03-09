import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  MaturityStageSchema,
  ProductionGateSchema,
  EvaluateGateBodySchema,
  PatchCheckBodySchema,
  AdvanceStageBodySchema,
  type MaturityStage,
  type ProductionGate,
  type GateCheck,
  type MaturityStageValue,
  type ReadinessItem,
  type ReadinessCategory,
  type ProductionReadinessChecklist,
  type ReadinessCache,
} from "../schemas/maturity.js";
import { type Project } from "../schemas/project.js";

const maturity = new Hono();

// ---- helpers ----

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json"),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function maturityDir(slug: string): string {
  return path.join(projectDir(slug), "maturity");
}

function stagePath(slug: string): string {
  return path.join(maturityDir(slug), "stage.json");
}

function gatesDir(slug: string): string {
  return path.join(maturityDir(slug), "gates");
}

function gatePath(slug: string, gateId: string): string {
  return path.join(gatesDir(slug), `${gateId}.json`);
}

async function loadStage(
  slug: string,
  projectId: string,
): Promise<MaturityStage> {
  try {
    return await readJSON<MaturityStage>(stagePath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      // Return default
      return {
        project_id: projectId,
        current_stage: "vibe",
        stage_history: [],
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

async function saveStage(slug: string, stage: MaturityStage): Promise<void> {
  await ensureDir(maturityDir(slug));
  await writeJSON(stagePath(slug), stage);
}

async function loadGate(
  slug: string,
  gateId: string,
): Promise<ProductionGate | null> {
  try {
    return await readJSON<ProductionGate>(gatePath(slug, gateId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveGate(
  slug: string,
  gate: ProductionGate,
): Promise<void> {
  await ensureDir(gatesDir(slug));
  await writeJSON(gatePath(slug, gate.id), gate);
}

// ---- Gate check definitions per stage transition ----

interface CheckTemplate {
  label: string;
  description: string;
  type: "automatic" | "manual";
}

function getCheckTemplates(
  from: MaturityStageValue,
  to: MaturityStageValue,
): CheckTemplate[] {
  const key = `${from}→${to}`;
  const templates: Record<string, CheckTemplate[]> = {
    "vibe→structured": [
      {
        label: "README exists",
        description: "Project has a README.md file",
        type: "automatic",
      },
      {
        label: "Source files present",
        description: "Project directory contains source code files",
        type: "automatic",
      },
      {
        label: "Architecture documented",
        description:
          "Team has documented basic architecture decisions (manual review)",
        type: "manual",
      },
      {
        label: "Basic linting configured",
        description: "Linter configuration file is present",
        type: "automatic",
      },
    ],
    "structured→architected": [
      {
        label: "TypeScript config present",
        description: "tsconfig.json exists",
        type: "automatic",
      },
      {
        label: "Package.json present",
        description: "package.json exists with scripts",
        type: "automatic",
      },
      {
        label: "ADRs documented",
        description:
          "Architecture Decision Records or equivalent docs exist (manual review)",
        type: "manual",
      },
      {
        label: "Module boundaries defined",
        description: "Clear separation of concerns documented (manual review)",
        type: "manual",
      },
    ],
    "architected→reviewed": [
      {
        label: "CI configuration present",
        description: "CI/CD pipeline config file exists",
        type: "automatic",
      },
      {
        label: "Code review process documented",
        description:
          "CONTRIBUTING.md or review guidelines present (manual review)",
        type: "manual",
      },
      {
        label: "Security review completed",
        description: "Security checklist reviewed by team (manual review)",
        type: "manual",
      },
      {
        label: "Test suite present",
        description: "Test files exist in the project",
        type: "automatic",
      },
    ],
    "reviewed→production": [
      {
        label: "Observability configured",
        description: "Logging and monitoring configured (manual review)",
        type: "manual",
      },
      {
        label: "Rollback plan documented",
        description: "Rollback procedure documented (manual review)",
        type: "manual",
      },
      {
        label: "Performance benchmarks met",
        description: "Load testing completed and benchmarks documented (manual review)",
        type: "manual",
      },
      {
        label: "Data backup strategy defined",
        description: "Backup and recovery procedures documented (manual review)",
        type: "manual",
      },
    ],
  };

  return templates[key] ?? [
    {
      label: "Manual review required",
      description: "Manually confirm this stage transition is appropriate",
      type: "manual",
    },
  ];
}

/** Run automatic checks against the filesystem (heuristic). */
async function runAutomaticCheck(
  slug: string,
  label: string,
): Promise<{ status: "passed" | "failed"; details: string }> {
  const { access } = await import("node:fs/promises");
  const pDir = projectDir(slug);

  const checkFile = async (rel: string): Promise<boolean> => {
    try {
      await access(path.join(pDir, rel));
      return true;
    } catch {
      return false;
    }
  };

  const checkGlob = async (patterns: string[]): Promise<boolean> => {
    for (const p of patterns) {
      if (await checkFile(p)) return true;
    }
    return false;
  };

  switch (label) {
    case "README exists": {
      const ok = await checkGlob(["README.md", "readme.md", "README.txt"]);
      return ok
        ? { status: "passed", details: "README file found" }
        : { status: "failed", details: "No README file found" };
    }
    case "Source files present": {
      // Just check if project dir exists and has any content
      try {
        const { readdir } = await import("node:fs/promises");
        const files = await readdir(pDir);
        return files.length > 0
          ? { status: "passed", details: `${files.length} items in project dir` }
          : { status: "failed", details: "Project directory is empty" };
      } catch {
        return { status: "failed", details: "Project directory not accessible" };
      }
    }
    case "Basic linting configured": {
      const ok = await checkGlob([
        ".eslintrc.js",
        ".eslintrc.json",
        ".eslintrc.yml",
        ".eslintrc",
        "eslint.config.js",
        "eslint.config.ts",
        ".biome.json",
        "biome.json",
      ]);
      return ok
        ? { status: "passed", details: "Linter config found" }
        : { status: "failed", details: "No linter config found" };
    }
    case "TypeScript config present": {
      const ok = await checkGlob(["tsconfig.json", "tsconfig.base.json"]);
      return ok
        ? { status: "passed", details: "tsconfig.json found" }
        : { status: "failed", details: "No tsconfig.json found" };
    }
    case "Package.json present": {
      const ok = await checkFile("package.json");
      return ok
        ? { status: "passed", details: "package.json found" }
        : { status: "failed", details: "No package.json found" };
    }
    case "CI configuration present": {
      const ok = await checkGlob([
        ".github/workflows",
        ".gitlab-ci.yml",
        ".circleci/config.yml",
        "Jenkinsfile",
        ".travis.yml",
      ]);
      return ok
        ? { status: "passed", details: "CI config found" }
        : { status: "failed", details: "No CI configuration found" };
    }
    case "Test suite present": {
      const ok = await checkGlob([
        "tests",
        "test",
        "__tests__",
        "spec",
        "vitest.config.ts",
        "jest.config.ts",
        "jest.config.js",
      ]);
      return ok
        ? { status: "passed", details: "Test directory/config found" }
        : { status: "failed", details: "No test suite found" };
    }
    default:
      return { status: "passed", details: "Automatic check passed (default)" };
  }
}

function computeOverallStatus(
  checks: GateCheck[],
): "pending" | "passed" | "failed" {
  if (checks.some((c) => c.status === "failed")) return "failed";
  if (checks.every((c) => c.status === "passed" || c.status === "skipped"))
    return "passed";
  return "pending";
}

// ---- Routes ----

// GET /hub/projects/:projectId/maturity/stage
maturity.get("/hub/projects/:projectId/maturity/stage", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const stage = await loadStage(slug, project.id);
  return c.json(stage);
});

// POST /hub/projects/:projectId/maturity/gates/evaluate
maturity.post("/hub/projects/:projectId/maturity/gates/evaluate", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json();
  const parsed = EvaluateGateBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }
  const { from_stage, to_stage } = parsed.data;

  const templates = getCheckTemplates(from_stage, to_stage);
  const now = new Date().toISOString();
  const checks: GateCheck[] = [];

  for (const tpl of templates) {
    const checkId = randomUUID();
    if (tpl.type === "automatic") {
      const result = await runAutomaticCheck(slug, tpl.label);
      checks.push({
        id: checkId,
        label: tpl.label,
        description: tpl.description,
        type: "automatic",
        status: result.status,
        details: result.details,
        checked_at: now,
      });
    } else {
      checks.push({
        id: checkId,
        label: tpl.label,
        description: tpl.description,
        type: "manual",
        status: "pending",
        details: null,
        checked_at: null,
      });
    }
  }

  const gate: ProductionGate = {
    id: randomUUID(),
    project_id: project.id,
    from_stage,
    to_stage,
    checks,
    overall_status: computeOverallStatus(checks),
    blocking: true,
    created_at: now,
    resolved_at: null,
  };

  await saveGate(slug, gate);
  return c.json(gate, 201);
});

// PATCH /hub/projects/:projectId/maturity/gates/:gateId/checks/:checkId
maturity.patch(
  "/hub/projects/:projectId/maturity/gates/:gateId/checks/:checkId",
  async (c) => {
    const slug = c.req.param("projectId");
    const gateId = c.req.param("gateId");
    const checkId = c.req.param("checkId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const gate = await loadGate(slug, gateId);
    if (!gate) return c.json({ error: "Gate not found" }, 404);

    const body = await c.req.json();
    const parsed = PatchCheckBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid body", details: parsed.error.issues },
        400,
      );
    }

    const checkIndex = gate.checks.findIndex((ch) => ch.id === checkId);
    if (checkIndex === -1) return c.json({ error: "Check not found" }, 404);

    const check = gate.checks[checkIndex]!;
    if (check.type !== "manual") {
      return c.json({ error: "Only manual checks can be updated" }, 400);
    }

    const now = new Date().toISOString();
    gate.checks[checkIndex] = {
      ...check,
      status: parsed.data.status,
      details: parsed.data.details !== undefined ? parsed.data.details ?? null : check.details,
      checked_at: now,
    };

    gate.overall_status = computeOverallStatus(gate.checks);
    if (gate.overall_status === "passed" && gate.resolved_at === null) {
      gate.resolved_at = now;
    }

    await saveGate(slug, gate);
    return c.json(gate);
  },
);

// ---- Stage progression helpers ----

const STAGE_ORDER: MaturityStageValue[] = [
  "vibe",
  "structured",
  "architected",
  "reviewed",
  "production",
];

function stageLevel(stage: MaturityStageValue): number {
  return STAGE_ORDER.indexOf(stage);
}

function nextStage(stage: MaturityStageValue): MaturityStageValue | null {
  const idx = stageLevel(stage);
  return idx >= 0 && idx < STAGE_ORDER.length - 1
    ? (STAGE_ORDER[idx + 1] ?? null)
    : null;
}

async function listGates(slug: string): Promise<ProductionGate[]> {
  const dir = gatesDir(slug);
  try {
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(dir);
    const gates: ProductionGate[] = [];
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const gateId = file.replace(".json", "");
      const gate = await loadGate(slug, gateId);
      if (gate) gates.push(gate);
    }
    return gates;
  } catch {
    return [];
  }
}

// ---- Readiness cache helpers ----

function readinessCachePath(slug: string): string {
  return path.join(maturityDir(slug), "readiness-cache.json");
}

async function loadReadinessCache(
  slug: string,
): Promise<ReadinessCache | null> {
  try {
    return await readJSON<ReadinessCache>(readinessCachePath(slug));
  } catch {
    return null;
  }
}

async function saveReadinessCache(
  slug: string,
  cache: ReadinessCache,
): Promise<void> {
  await ensureDir(maturityDir(slug));
  await writeJSON(readinessCachePath(slug), cache);
}

function isReadinessCacheValid(cache: ReadinessCache): boolean {
  const cachedAt = new Date(cache.cached_at).getTime();
  const ttlMs = cache.ttl_minutes * 60 * 1000;
  return Date.now() - cachedAt < ttlMs;
}

// ---- Readiness computation ----

function computeCompletionRate(items: ReadinessItem[]): number {
  const applicable = items.filter((i) => i.status !== "not_applicable");
  if (applicable.length === 0) return 0;
  const met = applicable.filter((i) => i.status === "met").length;
  return Math.round((met / applicable.length) * 100);
}

async function computeReadinessChecklist(
  slug: string,
  projectId: string,
  currentStage: MaturityStageValue,
): Promise<ProductionReadinessChecklist> {
  const level = stageLevel(currentStage);
  const { access } = await import("node:fs/promises");
  const pDir = projectDir(slug);

  const fileExists = async (rel: string): Promise<boolean> => {
    try {
      await access(path.join(pDir, rel));
      return true;
    } catch {
      return false;
    }
  };

  const fileExistsAny = async (rels: string[]): Promise<boolean> => {
    for (const rel of rels) {
      if (await fileExists(rel)) return true;
    }
    return false;
  };

  // Security category
  const hasGitignore = await fileExists(".gitignore");
  const hasEnvExample = await fileExistsAny([".env.example", ".env.sample"]);
  const hasDependabot = await fileExistsAny([
    ".github/dependabot.yml",
    ".snyk",
    ".nsprc",
  ]);
  const securityItems: ReadinessItem[] = [
    {
      id: "sec-1",
      label: "Secrets management (.gitignore + .env.example)",
      status:
        hasGitignore && hasEnvExample
          ? "met"
          : hasGitignore
            ? "partial"
            : "not_met",
      evidence: hasGitignore
        ? ".gitignore found" + (hasEnvExample ? ", .env.example found" : "")
        : null,
    },
    {
      id: "sec-2",
      label: "Dependency vulnerability scanning configured",
      status: hasDependabot ? "met" : level >= 3 ? "not_met" : "not_applicable",
      evidence: hasDependabot ? "Dependabot/.snyk config found" : null,
    },
    {
      id: "sec-3",
      label: "Input validation implemented",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence:
        level >= 3
          ? `Stage ${currentStage}: input validation expected`
          : null,
    },
    {
      id: "sec-4",
      label: "Authentication/authorization documented",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence:
        level >= 3
          ? `Stage ${currentStage}: auth documented`
          : null,
    },
    {
      id: "sec-5",
      label: "OWASP Top 10 review completed",
      status: level >= 4 ? "met" : level >= 3 ? "partial" : "not_met",
      evidence: level >= 4 ? "Production stage: OWASP review completed" : null,
    },
  ];

  // Performance category
  const hasLoadTest = await fileExistsAny([
    "load-tests",
    "perf-tests",
    "k6",
    "locust",
    "artillery.yml",
    "k6.js",
  ]);
  const performanceItems: ReadinessItem[] = [
    {
      id: "perf-1",
      label: "Load/stress testing documented",
      status: hasLoadTest ? "met" : level >= 3 ? "not_met" : "not_applicable",
      evidence: hasLoadTest ? "Load test config found" : null,
    },
    {
      id: "perf-2",
      label: "Response time targets defined",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence:
        level >= 3
          ? `Stage ${currentStage}: response time targets expected`
          : null,
    },
    {
      id: "perf-3",
      label: "Caching strategy documented",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence: level >= 3 ? "Caching strategy documented" : null,
    },
    {
      id: "perf-4",
      label: "Database query optimization reviewed",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_applicable",
      evidence: level >= 3 ? "DB optimization reviewed" : null,
    },
    {
      id: "perf-5",
      label: "CDN/static asset optimization configured",
      status: level >= 4 ? "met" : level >= 3 ? "partial" : "not_applicable",
      evidence: level >= 4 ? "Production: CDN configured" : null,
    },
  ];

  // Observability category
  const hasMonitoringConfig = await fileExistsAny([
    "prometheus.yml",
    "grafana",
    ".sentry.properties",
    "datadog.yaml",
    "newrelic.js",
  ]);
  const observabilityItems: ReadinessItem[] = [
    {
      id: "obs-1",
      label: "Structured logging configured",
      status: level >= 2 ? "met" : level >= 1 ? "partial" : "not_met",
      evidence: level >= 2 ? "Structured logging expected at this stage" : null,
    },
    {
      id: "obs-2",
      label: "Metrics collection enabled",
      status: hasMonitoringConfig
        ? "met"
        : level >= 3
          ? "not_met"
          : "not_applicable",
      evidence: hasMonitoringConfig ? "Monitoring config found" : null,
    },
    {
      id: "obs-3",
      label: "Error tracking configured",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence: level >= 3 ? "Error tracking expected" : null,
    },
    {
      id: "obs-4",
      label: "Alerting rules defined",
      status: level >= 4 ? "met" : level >= 3 ? "partial" : "not_applicable",
      evidence: level >= 4 ? "Alerting configured for production" : null,
    },
    {
      id: "obs-5",
      label: "Health check endpoints present",
      status: level >= 2 ? "met" : level >= 1 ? "partial" : "not_met",
      evidence: level >= 2 ? "Health check expected at this stage" : null,
    },
  ];

  // Reliability category
  const hasCiConfig = await fileExistsAny([
    ".github/workflows",
    ".gitlab-ci.yml",
    ".circleci/config.yml",
    "Jenkinsfile",
  ]);
  const reliabilityItems: ReadinessItem[] = [
    {
      id: "rel-1",
      label: "Error handling strategy defined",
      status: level >= 2 ? "met" : level >= 1 ? "partial" : "not_met",
      evidence: level >= 2 ? "Error handling expected at architected stage" : null,
    },
    {
      id: "rel-2",
      label: "CI/CD pipeline configured",
      status: hasCiConfig ? "met" : level >= 2 ? "not_met" : "not_applicable",
      evidence: hasCiConfig ? "CI/CD config found" : null,
    },
    {
      id: "rel-3",
      label: "Rollback plan documented",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_applicable",
      evidence: level >= 3 ? "Rollback plan documented" : null,
    },
    {
      id: "rel-4",
      label: "Graceful degradation implemented",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence: level >= 3 ? "Graceful degradation expected" : null,
    },
    {
      id: "rel-5",
      label: "Disaster recovery procedure tested",
      status: level >= 4 ? "met" : level >= 3 ? "partial" : "not_applicable",
      evidence: level >= 4 ? "DR procedure tested" : null,
    },
  ];

  // Data category
  const hasMigrations = await fileExistsAny([
    "migrations",
    "db/migrations",
    "database/migrations",
    "prisma/migrations",
  ]);
  const dataItems: ReadinessItem[] = [
    {
      id: "data-1",
      label: "Database migrations versioned",
      status: hasMigrations
        ? "met"
        : level >= 2
          ? "not_applicable"
          : "not_applicable",
      evidence: hasMigrations ? "Migrations directory found" : null,
    },
    {
      id: "data-2",
      label: "Data backup strategy documented",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence: level >= 3 ? "Backup strategy documented" : null,
    },
    {
      id: "data-3",
      label: "Data retention policy defined",
      status: level >= 4 ? "met" : level >= 3 ? "partial" : "not_applicable",
      evidence: level >= 4 ? "Retention policy defined" : null,
    },
    {
      id: "data-4",
      label: "PII/sensitive data handling documented",
      status: level >= 3 ? "met" : level >= 2 ? "partial" : "not_met",
      evidence: level >= 3 ? "PII handling documented" : null,
    },
    {
      id: "data-5",
      label: "Recovery procedure tested",
      status: level >= 4 ? "met" : level >= 3 ? "partial" : "not_applicable",
      evidence: level >= 4 ? "Recovery procedure tested" : null,
    },
  ];

  const categories: ReadinessCategory[] = [
    {
      name: "Security",
      items: securityItems,
      completion_rate: computeCompletionRate(securityItems),
    },
    {
      name: "Performance",
      items: performanceItems,
      completion_rate: computeCompletionRate(performanceItems),
    },
    {
      name: "Observability",
      items: observabilityItems,
      completion_rate: computeCompletionRate(observabilityItems),
    },
    {
      name: "Reliability",
      items: reliabilityItems,
      completion_rate: computeCompletionRate(reliabilityItems),
    },
    {
      name: "Data",
      items: dataItems,
      completion_rate: computeCompletionRate(dataItems),
    },
  ];

  const overall_readiness = Math.round(
    categories.reduce((sum, c) => sum + c.completion_rate, 0) /
      categories.length,
  );

  const blockers = categories
    .flatMap((c) => c.items)
    .filter((i) => i.status === "not_met");

  return {
    project_id: projectId,
    categories,
    overall_readiness,
    blockers,
    computed_at: new Date().toISOString(),
  };
}

// ---- POST /hub/projects/:projectId/maturity/advance ----

maturity.post("/hub/projects/:projectId/maturity/advance", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json();
  const parsed = AdvanceStageBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }
  const { to_stage } = parsed.data;

  const stage = await loadStage(slug, project.id);
  const currentLevel = stageLevel(stage.current_stage);
  const targetLevel = stageLevel(to_stage);

  // Must advance exactly one step
  if (targetLevel !== currentLevel + 1) {
    return c.json(
      {
        error: "Invalid stage transition",
        message: `Can only advance one stage at a time. Current: ${stage.current_stage}, requested: ${to_stage}. Next valid stage: ${nextStage(stage.current_stage) ?? "none (already at production)"}`,
      },
      400,
    );
  }

  // Check that a gate for current_stage → to_stage has passed
  const gates = await listGates(slug);
  const passedGate = gates.find(
    (g) =>
      g.from_stage === stage.current_stage &&
      g.to_stage === to_stage &&
      g.overall_status === "passed",
  );

  if (!passedGate) {
    const pendingGate = gates.find(
      (g) => g.from_stage === stage.current_stage && g.to_stage === to_stage,
    );
    return c.json(
      {
        error: "Gate not passed",
        message: `Cannot advance to ${to_stage}: no passed gate found for transition ${stage.current_stage} → ${to_stage}. ${pendingGate ? `Gate ${pendingGate.id} exists but has status: ${pendingGate.overall_status}` : "Use POST /maturity/gates/evaluate to create a gate."}`,
      },
      400,
    );
  }

  const now = new Date().toISOString();

  // Record current stage in history before advancing
  stage.stage_history.push({
    stage: stage.current_stage,
    entered_at: stage.updated_at,
    gate_passed: true,
    gate_results: { gate_id: passedGate.id, resolved_at: passedGate.resolved_at },
  });

  stage.current_stage = to_stage;
  stage.updated_at = now;

  await saveStage(slug, stage);
  return c.json(stage);
});

// ---- GET /hub/projects/:projectId/maturity/readiness ----

maturity.get("/hub/projects/:projectId/maturity/readiness", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Check cache
  const cached = await loadReadinessCache(slug);
  if (cached && isReadinessCacheValid(cached)) {
    return c.json(cached.checklist);
  }

  const stage = await loadStage(slug, project.id);
  const checklist = await computeReadinessChecklist(
    slug,
    project.id,
    stage.current_stage,
  );

  const now = new Date().toISOString();
  await saveReadinessCache(slug, {
    checklist,
    cached_at: now,
    ttl_minutes: 10,
  });

  return c.json(checklist);
});

export { maturity };

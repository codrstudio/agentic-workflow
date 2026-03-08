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
  type MaturityStage,
  type ProductionGate,
  type GateCheck,
  type MaturityStageValue,
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

export { maturity };

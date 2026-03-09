import { Hono } from "hono";
import path from "node:path";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  TestCoverageGateConfigSchema,
  ContributionQualityConfigSchema,
  PatchTestCoverageGateConfigBody,
  PatchContributionQualityConfigBody,
  type TestCoverageGateConfig,
  type ContributionQualityConfig,
} from "../schemas/quality-gate-configs.js";

const qualityGateConfigs = new Hono();

// --- Directory/file helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function coverageConfigPath(slug: string): string {
  return path.join(projectDir(slug), "test-coverage-gate-config.json");
}

function qualityConfigPath(slug: string): string {
  return path.join(projectDir(slug), "contribution-quality-config.json");
}

function defaultCoverageConfig(projectId: string): TestCoverageGateConfig {
  return TestCoverageGateConfigSchema.parse({
    project_id: projectId,
    enabled: false,
    coverage_threshold_pct: 70,
    coverage_tool: "vitest",
    report_dir: "coverage",
    fail_on_uncovered_files: false,
    updated_at: new Date().toISOString(),
  });
}

function defaultQualityConfig(projectId: string): ContributionQualityConfig {
  return ContributionQualityConfigSchema.parse({
    project_id: projectId,
    enabled: false,
    min_quality_score: 60,
    auto_reject_below: 30,
    check_ai_patterns: true,
    check_test_coverage: true,
    check_code_duplication: true,
    check_security_patterns: true,
    check_architectural_conformance: true,
    updated_at: new Date().toISOString(),
  });
}

async function loadCoverageConfig(slug: string): Promise<TestCoverageGateConfig> {
  try {
    const raw = await readJSON<TestCoverageGateConfig>(coverageConfigPath(slug));
    return TestCoverageGateConfigSchema.parse(raw);
  } catch {
    return defaultCoverageConfig(slug);
  }
}

async function loadQualityConfig(slug: string): Promise<ContributionQualityConfig> {
  try {
    const raw = await readJSON<ContributionQualityConfig>(qualityConfigPath(slug));
    return ContributionQualityConfigSchema.parse(raw);
  } catch {
    return defaultQualityConfig(slug);
  }
}

// --- TestCoverageGateConfig endpoints ---

// GET /hub/projects/:projectId/test-coverage-gate-config
qualityGateConfigs.get("/hub/projects/:projectId/test-coverage-gate-config", async (c) => {
  const slug = c.req.param("projectId");
  const cfg = await loadCoverageConfig(slug);
  return c.json(cfg);
});

// PATCH /hub/projects/:projectId/test-coverage-gate-config
qualityGateConfigs.patch("/hub/projects/:projectId/test-coverage-gate-config", async (c) => {
  const slug = c.req.param("projectId");
  const body = await c.req.json();
  const parsed = PatchTestCoverageGateConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const current = await loadCoverageConfig(slug);
  const patch = parsed.data;
  const updated: TestCoverageGateConfig = {
    ...current,
    ...patch,
    custom_command: patch.custom_command === null ? undefined : (patch.custom_command ?? current.custom_command),
    updated_at: new Date().toISOString(),
  };

  await writeJSON(coverageConfigPath(slug), updated);
  return c.json(updated);
});

// --- ContributionQualityConfig endpoints ---

// GET /hub/projects/:projectId/contribution-quality-config
qualityGateConfigs.get("/hub/projects/:projectId/contribution-quality-config", async (c) => {
  const slug = c.req.param("projectId");
  const cfg = await loadQualityConfig(slug);
  return c.json(cfg);
});

// PATCH /hub/projects/:projectId/contribution-quality-config
qualityGateConfigs.patch("/hub/projects/:projectId/contribution-quality-config", async (c) => {
  const slug = c.req.param("projectId");
  const body = await c.req.json();
  const parsed = PatchContributionQualityConfigBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const current = await loadQualityConfig(slug);
  const updated: ContributionQualityConfig = {
    ...current,
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(qualityConfigPath(slug), updated);
  return c.json(updated);
});

export { qualityGateConfigs };

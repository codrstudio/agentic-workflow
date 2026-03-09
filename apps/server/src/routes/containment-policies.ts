import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir, unlink } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ContainmentPolicySchema,
  CreateContainmentPolicyBody,
  PatchContainmentPolicyBody,
  LEVEL_SEVERITY,
  type ContainmentPolicy,
} from "../schemas/containment-policy.js";
import { type Project } from "../schemas/project.js";

const containmentPolicies = new Hono();

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

function policiesDirPath(slug: string): string {
  return path.join(projectDir(slug), "containment-policies");
}

function policyPath(slug: string, id: string): string {
  return path.join(policiesDirPath(slug), `${id}.json`);
}

async function loadAllPolicies(slug: string): Promise<ContainmentPolicy[]> {
  const dir = policiesDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const policies: ContainmentPolicy[] = [];
  for (const file of files) {
    try {
      const p = await readJSON<ContainmentPolicy>(path.join(dir, file));
      policies.push(p);
    } catch {
      // skip malformed files
    }
  }
  return policies;
}

// GET /hub/projects/:slug/containment/policies
containmentPolicies.get("/hub/projects/:slug/containment/policies", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let policies = await loadAllPolicies(slug);

  const levelFilter = c.req.query("level");
  const enabledFilter = c.req.query("enabled");

  if (levelFilter) {
    policies = policies.filter((p) => p.level === levelFilter);
  }

  if (enabledFilter !== undefined) {
    const enabledBool = enabledFilter === "true";
    policies = policies.filter((p) => p.enabled === enabledBool);
  }

  return c.json(policies);
});

// POST /hub/projects/:slug/containment/policies
containmentPolicies.post("/hub/projects/:slug/containment/policies", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateContainmentPolicyBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const data = parsed.data;

  const policy: ContainmentPolicy = {
    id,
    project_id: project.id,
    name: data.name,
    description: data.description ?? null,
    level: data.level,
    applies_to: {
      steps: data.applies_to?.steps ?? null,
      agents: data.applies_to?.agents ?? null,
    },
    execution_limits: {
      max_turns: data.execution_limits?.max_turns ?? 200,
      timeout_minutes: data.execution_limits?.timeout_minutes ?? 30,
      max_output_tokens: data.execution_limits?.max_output_tokens ?? null,
    },
    path_restrictions: {
      allowed_paths: data.path_restrictions?.allowed_paths ?? [],
      blocked_paths: data.path_restrictions?.blocked_paths ?? [],
      read_only: data.path_restrictions?.read_only ?? [],
    },
    tool_restrictions: {
      allowed_tools: data.tool_restrictions?.allowed_tools ?? null,
      blocked_tools: data.tool_restrictions?.blocked_tools ?? null,
    },
    graduated_response: {
      on_timeout: data.graduated_response?.on_timeout ?? "kill",
      on_drift: data.graduated_response?.on_drift ?? "warn",
    },
    enabled: data.enabled ?? true,
    created_at: now,
    updated_at: now,
  };

  // Validate before saving
  const validated = ContainmentPolicySchema.safeParse(policy);
  if (!validated.success) {
    return c.json({ error: "Policy construction failed", details: validated.error.issues }, 500);
  }

  await ensureDir(policiesDirPath(slug));
  await writeJSON(policyPath(slug, id), validated.data);

  return c.json(validated.data, 201);
});

// GET /hub/projects/:slug/containment/resolve
containmentPolicies.get("/hub/projects/:slug/containment/resolve", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const step = c.req.query("step");
  const agent = c.req.query("agent");

  const allPolicies = await loadAllPolicies(slug);

  // Only enabled policies
  const activePolicies = allPolicies.filter((p) => p.enabled);

  // Filter to applicable policies (applies_to null means applies to all)
  const applicable = activePolicies.filter((p) => {
    const stepsMatch =
      p.applies_to.steps === null ||
      (step !== undefined && p.applies_to.steps.includes(step));
    const agentsMatch =
      p.applies_to.agents === null ||
      (agent !== undefined && p.applies_to.agents.includes(agent));
    return stepsMatch && agentsMatch;
  });

  if (applicable.length === 0) {
    return c.json(null);
  }

  // Return the most restrictive (highest severity level)
  const mostRestrictive = applicable.reduce((best, current) => {
    return LEVEL_SEVERITY[current.level] > LEVEL_SEVERITY[best.level] ? current : best;
  });

  return c.json(mostRestrictive);
});

// GET /hub/projects/:slug/containment/policies/:policyId
containmentPolicies.get(
  "/hub/projects/:slug/containment/policies/:policyId",
  async (c) => {
    const slug = c.req.param("slug");
    const policyId = c.req.param("policyId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    try {
      const policy = await readJSON<ContainmentPolicy>(policyPath(slug, policyId));
      return c.json(policy);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) return c.json({ error: "Policy not found" }, 404);
      throw err;
    }
  }
);

// PATCH /hub/projects/:slug/containment/policies/:policyId
containmentPolicies.patch(
  "/hub/projects/:slug/containment/policies/:policyId",
  async (c) => {
    const slug = c.req.param("slug");
    const policyId = c.req.param("policyId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let existing: ContainmentPolicy;
    try {
      existing = await readJSON<ContainmentPolicy>(policyPath(slug, policyId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) return c.json({ error: "Policy not found" }, 404);
      throw err;
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchContainmentPolicyBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
    }

    const data = parsed.data;
    const now = new Date().toISOString();

    const updated: ContainmentPolicy = {
      ...existing,
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.level !== undefined ? { level: data.level } : {}),
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      applies_to: data.applies_to
        ? {
            steps:
              data.applies_to.steps !== undefined
                ? (data.applies_to.steps ?? null)
                : existing.applies_to.steps,
            agents:
              data.applies_to.agents !== undefined
                ? (data.applies_to.agents ?? null)
                : existing.applies_to.agents,
          }
        : existing.applies_to,
      execution_limits: data.execution_limits
        ? {
            max_turns:
              data.execution_limits.max_turns ?? existing.execution_limits.max_turns,
            timeout_minutes:
              data.execution_limits.timeout_minutes ??
              existing.execution_limits.timeout_minutes,
            max_output_tokens:
              data.execution_limits.max_output_tokens !== undefined
                ? (data.execution_limits.max_output_tokens ?? null)
                : existing.execution_limits.max_output_tokens,
          }
        : existing.execution_limits,
      path_restrictions: data.path_restrictions
        ? {
            allowed_paths:
              data.path_restrictions.allowed_paths ?? existing.path_restrictions.allowed_paths,
            blocked_paths:
              data.path_restrictions.blocked_paths ?? existing.path_restrictions.blocked_paths,
            read_only:
              data.path_restrictions.read_only ?? existing.path_restrictions.read_only,
          }
        : existing.path_restrictions,
      tool_restrictions: data.tool_restrictions
        ? {
            allowed_tools:
              data.tool_restrictions.allowed_tools !== undefined
                ? (data.tool_restrictions.allowed_tools ?? null)
                : existing.tool_restrictions.allowed_tools,
            blocked_tools:
              data.tool_restrictions.blocked_tools !== undefined
                ? (data.tool_restrictions.blocked_tools ?? null)
                : existing.tool_restrictions.blocked_tools,
          }
        : existing.tool_restrictions,
      graduated_response: data.graduated_response
        ? {
            on_timeout:
              data.graduated_response.on_timeout ?? existing.graduated_response.on_timeout,
            on_drift:
              data.graduated_response.on_drift ?? existing.graduated_response.on_drift,
          }
        : existing.graduated_response,
      updated_at: now,
    };

    await writeJSON(policyPath(slug, policyId), updated);
    return c.json(updated);
  }
);

// DELETE /hub/projects/:slug/containment/policies/:policyId
containmentPolicies.delete(
  "/hub/projects/:slug/containment/policies/:policyId",
  async (c) => {
    const slug = c.req.param("slug");
    const policyId = c.req.param("policyId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const filePath = policyPath(slug, policyId);
    try {
      await unlink(filePath);
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return c.json({ error: "Policy not found" }, 404);
      throw err;
    }

    return c.body(null, 204);
  }
);

export { containmentPolicies };

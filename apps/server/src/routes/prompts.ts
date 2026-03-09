import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  PromptArtifactSchema,
  CreatePromptBody,
  PatchPromptBody,
  RenderPromptBody,
  PromptVersionSchema,
  CreateUsageBody,
  type PromptArtifact,
  type PromptVersion,
  type PromptUsageRecord,
} from "../schemas/prompt.js";
import { type Project } from "../schemas/project.js";

const prompts = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json")
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

function promptsDir(slug: string): string {
  return path.join(projectDir(slug), "prompts");
}

function promptPath(slug: string, id: string): string {
  return path.join(promptsDir(slug), `${id}.json`);
}

function versionsDir(slug: string, promptId: string): string {
  return path.join(promptsDir(slug), "versions", promptId);
}

function versionPath(slug: string, promptId: string, version: number): string {
  return path.join(versionsDir(slug, promptId), `v${version}.json`);
}

async function loadPrompt(
  slug: string,
  id: string
): Promise<PromptArtifact | null> {
  try {
    return await readJSON<PromptArtifact>(promptPath(slug, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadAllPrompts(slug: string): Promise<PromptArtifact[]> {
  const dir = promptsDir(slug);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const jsonFiles = entries.filter(
    (f) => f.endsWith(".json") && !f.startsWith(".")
  );

  const results: PromptArtifact[] = [];
  for (const file of jsonFiles) {
    try {
      const prompt = await readJSON<PromptArtifact>(path.join(dir, file));
      results.push(prompt);
    } catch {
      // skip invalid files
    }
  }
  return results;
}

function detectVariables(content: string): string[] {
  const regex = /\{(\w+)\}/g;
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    vars.add(match[1]!);
  }
  return Array.from(vars);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// POST /hub/projects/:slug/prompts — create prompt
prompts.post("/hub/projects/:slug/prompts", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreatePromptBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const prompt: PromptArtifact = {
    id,
    project_id: slug,
    name: parsed.data.name,
    description: parsed.data.description,
    category: parsed.data.category,
    content: parsed.data.content,
    variables: parsed.data.variables,
    tags: parsed.data.tags,
    version: 1,
    is_template: parsed.data.is_template,
    is_deleted: false,
    parent_id: parsed.data.parent_id,
    created_at: now,
    updated_at: now,
  };

  await ensureDir(promptsDir(slug));
  await writeJSON(promptPath(slug, id), prompt);

  // Persist v1 as PromptVersion
  const v1: PromptVersion = {
    prompt_id: id,
    version: 1,
    content: prompt.content,
    variables: prompt.variables,
    created_at: now,
  };
  await ensureDir(versionsDir(slug, id));
  await writeJSON(versionPath(slug, id, 1), v1);

  return c.json(prompt, 201);
});

// GET /hub/projects/:slug/prompts — list prompts with filters
prompts.get("/hub/projects/:slug/prompts", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let all = await loadAllPrompts(slug);

  // Exclude soft-deleted by default
  all = all.filter((p) => !p.is_deleted);

  // Filter by category
  const category = c.req.query("category");
  if (category) {
    all = all.filter((p) => p.category === category);
  }

  // Filter by tag
  const tag = c.req.query("tag");
  if (tag) {
    all = all.filter((p) => p.tags.includes(tag));
  }

  // Filter by is_template
  const isTemplate = c.req.query("is_template");
  if (isTemplate !== undefined) {
    const val = isTemplate === "true";
    all = all.filter((p) => p.is_template === val);
  }

  // Search by name/description
  const search = c.req.query("search");
  if (search) {
    const lower = search.toLowerCase();
    all = all.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.description && p.description.toLowerCase().includes(lower))
    );
  }

  // Limit
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 50;
  all = all.slice(0, limit);

  return c.json(all);
});

// GET /hub/projects/:slug/prompts/:id — get single prompt
prompts.get("/hub/projects/:slug/prompts/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const prompt = await loadPrompt(slug, id);
  if (!prompt || prompt.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  return c.json(prompt);
});

// PATCH /hub/projects/:slug/prompts/:id — update prompt (increments version)
prompts.patch("/hub/projects/:slug/prompts/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const existing = await loadPrompt(slug, id);
  if (!existing || existing.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchPromptBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date().toISOString();

  // Persist current state as a PromptVersion before updating
  const prevVersion: PromptVersion = {
    prompt_id: id,
    version: existing.version,
    content: existing.content,
    variables: existing.variables,
    change_note: parsed.data.change_note,
    created_at: now,
  };
  await ensureDir(versionsDir(slug, id));
  await writeJSON(versionPath(slug, id, existing.version), prevVersion);

  const newVersion = existing.version + 1;

  const updated: PromptArtifact = {
    ...existing,
    name: parsed.data.name ?? existing.name,
    description:
      parsed.data.description !== undefined
        ? parsed.data.description
        : existing.description,
    category: parsed.data.category ?? existing.category,
    content: parsed.data.content ?? existing.content,
    variables: parsed.data.variables ?? existing.variables,
    tags: parsed.data.tags ?? existing.tags,
    is_template: parsed.data.is_template ?? existing.is_template,
    version: newVersion,
    updated_at: now,
  };

  await writeJSON(promptPath(slug, id), updated);

  // Also persist the new version
  const newVersionRecord: PromptVersion = {
    prompt_id: id,
    version: newVersion,
    content: updated.content,
    variables: updated.variables,
    change_note: parsed.data.change_note,
    created_at: now,
  };
  await writeJSON(versionPath(slug, id, newVersion), newVersionRecord);

  return c.json(updated);
});

// DELETE /hub/projects/:slug/prompts/:id — soft-delete
prompts.delete("/hub/projects/:slug/prompts/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const existing = await loadPrompt(slug, id);
  if (!existing || existing.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  const updated: PromptArtifact = {
    ...existing,
    is_deleted: true,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(promptPath(slug, id), updated);

  return c.json(updated);
});

// POST /hub/projects/:slug/prompts/:id/render — render with variables
prompts.post("/hub/projects/:slug/prompts/:id/render", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const prompt = await loadPrompt(slug, id);
  if (!prompt || prompt.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = RenderPromptBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  // Validate required variables are present
  const missingRequired = prompt.variables
    .filter((v) => v.required && !parsed.data.variables[v.name] && !v.default_value)
    .map((v) => v.name);

  if (missingRequired.length > 0) {
    return c.json(
      { error: "Missing required variables", missing: missingRequired },
      400
    );
  }

  // Render: substitute {variable_name} with provided values or defaults
  let rendered = prompt.content;
  const detectedVars = detectVariables(prompt.content);
  for (const varName of detectedVars) {
    const value: string =
      parsed.data.variables[varName] ??
      prompt.variables.find((v) => v.name === varName)?.default_value ??
      `{${varName}}`;
    rendered = rendered.replaceAll(`{${varName}}`, value);
  }

  return c.json({
    rendered_content: rendered,
    tokens_estimated: estimateTokens(rendered),
  });
});

// --- F-112: Versioning + Usage Tracking + Metrics ---

function usageDir(slug: string, promptId: string): string {
  return path.join(promptsDir(slug), "usage", promptId);
}

async function loadAllVersions(slug: string, promptId: string): Promise<PromptVersion[]> {
  const dir = versionsDir(slug, promptId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const vFiles = entries.filter((f) => f.startsWith("v") && f.endsWith(".json"));
  const results: PromptVersion[] = [];
  for (const file of vFiles) {
    try {
      const version = await readJSON<PromptVersion>(path.join(dir, file));
      results.push(version);
    } catch {
      // skip invalid files
    }
  }
  // Sort by version descending (most recent first)
  results.sort((a, b) => b.version - a.version);
  return results;
}

async function loadAllUsageRecords(slug: string, promptId: string): Promise<PromptUsageRecord[]> {
  const dir = usageDir(slug, promptId);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const jsonFiles = entries.filter((f) => f.endsWith(".json"));
  const results: PromptUsageRecord[] = [];
  for (const file of jsonFiles) {
    try {
      const record = await readJSON<PromptUsageRecord>(path.join(dir, file));
      results.push(record);
    } catch {
      // skip invalid files
    }
  }
  return results;
}

// GET /hub/projects/:slug/prompts/:id/versions — list all versions
prompts.get("/hub/projects/:slug/prompts/:id/versions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const prompt = await loadPrompt(slug, id);
  if (!prompt || prompt.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  const versions = await loadAllVersions(slug, id);
  return c.json(versions);
});

// POST /hub/projects/:slug/prompts/:id/restore/:version — restore old version
prompts.post("/hub/projects/:slug/prompts/:id/restore/:version", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const prompt = await loadPrompt(slug, id);
  if (!prompt || prompt.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  const versionNum = parseInt(c.req.param("version"), 10);
  if (isNaN(versionNum) || versionNum < 1) {
    return c.json({ error: "Invalid version number" }, 400);
  }

  // Load the target version
  let targetVersion: PromptVersion | null = null;
  try {
    targetVersion = await readJSON<PromptVersion>(versionPath(slug, id, versionNum));
  } catch {
    return c.json({ error: "Version not found" }, 404);
  }

  const now = new Date().toISOString();
  const newVersionNum = prompt.version + 1;

  // Create new version with old content
  const newVersionRecord: PromptVersion = {
    prompt_id: id,
    version: newVersionNum,
    content: targetVersion.content,
    variables: targetVersion.variables,
    change_note: `Restored from v${versionNum}`,
    created_at: now,
  };
  await ensureDir(versionsDir(slug, id));
  await writeJSON(versionPath(slug, id, newVersionNum), newVersionRecord);

  // Update the prompt artifact
  const updated: PromptArtifact = {
    ...prompt,
    content: targetVersion.content,
    variables: targetVersion.variables,
    version: newVersionNum,
    updated_at: now,
  };
  await writeJSON(promptPath(slug, id), updated);

  return c.json(updated, 201);
});

// POST /hub/projects/:slug/prompts/:id/usage — record usage
prompts.post("/hub/projects/:slug/prompts/:id/usage", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const prompt = await loadPrompt(slug, id);
  if (!prompt || prompt.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateUsageBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date().toISOString();
  const recordId = randomUUID();

  const record: PromptUsageRecord = {
    id: recordId,
    prompt_id: id,
    version: parsed.data.version ?? prompt.version,
    session_id: parsed.data.session_id,
    used_at: now,
    variables_filled: parsed.data.variables_filled,
    outcome: parsed.data.outcome,
    user_rating: parsed.data.user_rating,
  };

  await ensureDir(usageDir(slug, id));
  await writeJSON(path.join(usageDir(slug, id), `${recordId}.json`), record);

  return c.json(record, 201);
});

// GET /hub/projects/:slug/prompts/:id/metrics — prompt metrics
prompts.get("/hub/projects/:slug/prompts/:id/metrics", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const prompt = await loadPrompt(slug, id);
  if (!prompt || prompt.is_deleted) {
    return c.json({ error: "Prompt not found" }, 404);
  }

  const usageRecords = await loadAllUsageRecords(slug, id);
  const versions = await loadAllVersions(slug, id);

  const totalUses = usageRecords.length;

  // Average rating (only from records with a rating)
  const ratedRecords = usageRecords.filter((r) => r.user_rating != null);
  const avgRating =
    ratedRecords.length > 0
      ? Math.round(
          (ratedRecords.reduce((sum, r) => sum + r.user_rating!, 0) /
            ratedRecords.length) *
            100
        ) / 100
      : null;

  // Success rate (only from records with known outcome)
  const knownOutcomes = usageRecords.filter((r) => r.outcome !== "unknown");
  const successRate =
    knownOutcomes.length > 0
      ? Math.round(
          (knownOutcomes.filter((r) => r.outcome === "success").length /
            knownOutcomes.length) *
            100
        ) / 100
      : null;

  // Last used
  const sortedByDate = [...usageRecords].sort(
    (a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime()
  );
  const lastUsed = sortedByDate.length > 0 ? sortedByDate[0]!.used_at : null;

  return c.json({
    prompt_id: id,
    total_uses: totalUses,
    avg_rating: avgRating,
    success_rate: successRate,
    versions_count: versions.length,
    last_used: lastUsed,
  });
});

export { prompts };

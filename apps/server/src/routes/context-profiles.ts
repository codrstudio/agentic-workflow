import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir, unlink } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateContextProfileBody,
  UpdateContextProfileBody,
  type ContextProfile,
} from "../schemas/context-profile.js";
import { type Project } from "../schemas/project.js";
import { type Source } from "../schemas/source.js";

const contextProfiles = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

// New F-223 persistence: context/profiles/{id}.json
function profilesDir(slug: string): string {
  return path.join(projectDir(slug), "context", "profiles");
}

function profilePath(slug: string, profileId: string): string {
  return path.join(profilesDir(slug), `${profileId}.json`);
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

async function loadProfile(
  slug: string,
  profileId: string
): Promise<ContextProfile | null> {
  try {
    return await readJSON<ContextProfile>(profilePath(slug, profileId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveProfile(
  slug: string,
  profile: ContextProfile
): Promise<void> {
  await ensureDir(profilesDir(slug));
  await writeJSON(profilePath(slug, profile.id), profile);
}

async function listAllProfiles(slug: string): Promise<ContextProfile[]> {
  const dir = profilesDir(slug);
  let entries: string[];
  try {
    const files = await readdir(dir);
    entries = files.filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const results: ContextProfile[] = [];
  for (const file of entries) {
    try {
      const profile = await readJSON<ContextProfile>(path.join(dir, file));
      results.push(profile);
    } catch {
      // skip corrupt files
    }
  }

  return results;
}

function applySourceDefaults(source: Record<string, unknown>): Source {
  return {
    ...source,
    category: source["category"] ?? "general",
    pinned: source["pinned"] ?? false,
    auto_include: source["auto_include"] ?? false,
    relevance_tags: source["relevance_tags"] ?? [],
  } as Source;
}

async function loadSources(slug: string): Promise<Source[]> {
  try {
    const raw = await readJSON<Record<string, unknown>[]>(
      path.join(projectDir(slug), "sources", "sources.json")
    );
    return raw.map(applySourceDefaults);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

// GET /hub/projects/:slug/context/profiles — list profiles
contextProfiles.get("/hub/projects/:slug/context/profiles", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const profiles = await listAllProfiles(slug);
  profiles.sort((a, b) => a.name.localeCompare(b.name));

  return c.json(profiles);
});

// POST /hub/projects/:slug/context/profiles — create profile
contextProfiles.post("/hub/projects/:slug/context/profiles", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateContextProfileBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const {
    name,
    description,
    is_default,
    included_sources,
    included_categories,
    excluded_sources,
    token_budget,
  } = parsed.data;

  const id = randomUUID();
  const now = new Date().toISOString();

  // If this profile is_default, clear default from others
  if (is_default) {
    const existing = await listAllProfiles(slug);
    for (const p of existing) {
      if (p.is_default) {
        p.is_default = false;
        p.updated_at = now;
        await saveProfile(slug, p);
      }
    }
  }

  const profile: ContextProfile = {
    id,
    project_id: project.id,
    name,
    description: description ?? null,
    is_default: is_default ?? false,
    included_sources: included_sources ?? [],
    included_categories: included_categories ?? [],
    excluded_sources: excluded_sources ?? [],
    token_budget: token_budget ?? 24000,
    current_token_count: 0,
    density_score: 0,
    created_at: now,
    updated_at: now,
  };

  await saveProfile(slug, profile);

  return c.json(profile, 201);
});

// GET /hub/projects/:slug/context/profiles/:id — get profile
contextProfiles.get(
  "/hub/projects/:slug/context/profiles/:id",
  async (c) => {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const profile = await loadProfile(slug, id);
    if (!profile) return c.json({ error: "Context profile not found" }, 404);

    return c.json(profile);
  }
);

// PUT /hub/projects/:slug/context/profiles/:id — update profile
contextProfiles.put(
  "/hub/projects/:slug/context/profiles/:id",
  async (c) => {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const profile = await loadProfile(slug, id);
    if (!profile) return c.json({ error: "Context profile not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = UpdateContextProfileBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const updates = parsed.data;
    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.description !== undefined) profile.description = updates.description ?? null;
    if (updates.included_sources !== undefined) profile.included_sources = updates.included_sources;
    if (updates.included_categories !== undefined) profile.included_categories = updates.included_categories;
    if (updates.excluded_sources !== undefined) profile.excluded_sources = updates.excluded_sources;
    if (updates.token_budget !== undefined) profile.token_budget = updates.token_budget;

    // If setting as default, clear default from others
    if (updates.is_default === true) {
      const existing = await listAllProfiles(slug);
      for (const p of existing) {
        if (p.id !== id && p.is_default) {
          p.is_default = false;
          p.updated_at = new Date().toISOString();
          await saveProfile(slug, p);
        }
      }
      profile.is_default = true;
    } else if (updates.is_default === false) {
      profile.is_default = false;
    }

    profile.updated_at = new Date().toISOString();
    await saveProfile(slug, profile);

    return c.json(profile);
  }
);

// DELETE /hub/projects/:slug/context/profiles/:id — delete profile
contextProfiles.delete(
  "/hub/projects/:slug/context/profiles/:id",
  async (c) => {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const profile = await loadProfile(slug, id);
    if (!profile) return c.json({ error: "Context profile not found" }, 404);

    try {
      await unlink(profilePath(slug, id));
    } catch {
      // ignore
    }

    return c.body(null, 204);
  }
);

// POST /hub/projects/:slug/context/profiles/:id/apply — activate profile for chat session
contextProfiles.post(
  "/hub/projects/:slug/context/profiles/:id/apply",
  async (c) => {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const profile = await loadProfile(slug, id);
    if (!profile) return c.json({ error: "Context profile not found" }, 404);

    const allSources = await loadSources(slug);

    // Filter active sources based on profile rules:
    // included_sources: explicit UUIDs to include
    // included_categories: include all sources in these categories
    // excluded_sources: explicit UUIDs to exclude
    const includedSourceSet = new Set(profile.included_sources);
    const excludedSourceSet = new Set(profile.excluded_sources);
    const includedCategories = new Set(profile.included_categories);

    const activeSources = allSources.filter((source) => {
      // Never include excluded sources
      if (excludedSourceSet.has(source.id)) return false;

      // Include if explicitly in included_sources
      if (includedSourceSet.has(source.id)) return true;

      // Include if category matches included_categories
      if (
        includedCategories.size > 0 &&
        source.category &&
        includedCategories.has(source.category)
      ) {
        return true;
      }

      // If no explicit filters set, include all non-excluded sources
      if (includedSourceSet.size === 0 && includedCategories.size === 0) {
        return true;
      }

      return false;
    });

    // Compute token count: estimate 1 token ~= 4 chars using size_bytes
    let tokenCount = 0;
    for (const source of activeSources) {
      tokenCount += Math.ceil(source.size_bytes / 4);
    }

    // Enforce token budget: remove lowest-priority sources if over budget
    let sourcesIncluded = activeSources;
    if (tokenCount > profile.token_budget) {
      // Sort by pinned (keep) then remove from end until within budget
      const sorted = [...activeSources].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0;
      });

      sourcesIncluded = [];
      let running = 0;
      for (const source of sorted) {
        const t = Math.ceil(source.size_bytes / 4);
        if (running + t <= profile.token_budget) {
          sourcesIncluded.push(source);
          running += t;
        }
      }
      tokenCount = running;
    }

    // Update profile with current token count
    profile.current_token_count = tokenCount;
    profile.updated_at = new Date().toISOString();
    await saveProfile(slug, profile);

    return c.json({
      applied: true,
      token_count: tokenCount,
      sources_included: sourcesIncluded.map((s) => s.id),
    });
  }
);

export { contextProfiles };

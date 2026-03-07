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
import { type ChatSession } from "../schemas/session.js";

const contextProfiles = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function profilesDir(slug: string): string {
  return path.join(projectDir(slug), "context-profiles");
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
    category: source.category ?? "general",
    pinned: source.pinned ?? false,
    auto_include: source.auto_include ?? false,
    relevance_tags: source.relevance_tags ?? [],
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

async function loadSession(
  slug: string,
  sessionId: string
): Promise<ChatSession | null> {
  try {
    return await readJSON<ChatSession>(
      path.join(projectDir(slug), "sessions", `${sessionId}.json`)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

// GET /hub/projects/:slug/context-profiles — list profiles
contextProfiles.get("/hub/projects/:slug/context-profiles", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const profiles = await listAllProfiles(slug);

  // Sort by name
  profiles.sort((a, b) => a.name.localeCompare(b.name));

  return c.json(profiles);
});

// POST /hub/projects/:slug/context-profiles — create profile
contextProfiles.post("/hub/projects/:slug/context-profiles", async (c) => {
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

  const { name, description, source_ids, is_default } = parsed.data;
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
    description,
    source_ids,
    is_default: is_default ?? false,
    created_at: now,
    updated_at: now,
  };

  await saveProfile(slug, profile);

  return c.json(profile, 201);
});

// GET /hub/projects/:slug/context-profiles/:id — get profile
contextProfiles.get(
  "/hub/projects/:slug/context-profiles/:id",
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

// PATCH /hub/projects/:slug/context-profiles/:id — update profile
contextProfiles.patch(
  "/hub/projects/:slug/context-profiles/:id",
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
    if (updates.description !== undefined) profile.description = updates.description;
    if (updates.source_ids !== undefined) profile.source_ids = updates.source_ids;

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

// DELETE /hub/projects/:slug/context-profiles/:id — delete profile
contextProfiles.delete(
  "/hub/projects/:slug/context-profiles/:id",
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

// GET /hub/projects/:slug/sessions/:id/resolved-context — resolve effective sources
contextProfiles.get(
  "/hub/projects/:slug/sessions/:id/resolved-context",
  async (c) => {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const session = await loadSession(slug, id);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const allSources = await loadSources(slug);

    // Collect effective source IDs: pinned + auto_include + session-selected
    const selectedIds = new Set(session.source_ids);
    const effectiveIds = new Set<string>();

    for (const source of allSources) {
      if (source.pinned || source.auto_include || selectedIds.has(source.id)) {
        effectiveIds.add(source.id);
      }
    }

    const effectiveSources = allSources.filter((s) => effectiveIds.has(s.id));

    // Estimate tokens: 1 token ~= 4 chars
    let totalChars = 0;
    for (const source of effectiveSources) {
      totalChars += source.size_bytes; // size_bytes approximates char count for text
    }
    const totalTokensEstimate = Math.ceil(totalChars / 4);

    // Strip content from response
    const sourcesResult = effectiveSources.map(({ content, ...rest }) => ({
      ...rest,
      included_by: [
        ...(rest.pinned ? ["pinned" as const] : []),
        ...(rest.auto_include ? ["auto_include" as const] : []),
        ...(selectedIds.has(rest.id) ? ["selected" as const] : []),
      ],
    }));

    return c.json({
      session_id: session.id,
      sources: sourcesResult,
      total_tokens_estimate: totalTokensEstimate,
    });
  }
);

export { contextProfiles };

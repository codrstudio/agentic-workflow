import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  readJSON,
  writeJSON,
  ensureDir,
  moveToTrash,
  listDirs,
  generateSlug,
} from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  CreateProjectBody,
  UpdateProjectBody,
  type Project,
} from "../schemas/project.js";
import { ZodError } from "zod";

const projects = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function projectJsonPath(slug: string): string {
  return path.join(projectDir(slug), "project.json");
}

/**
 * Ensure slug uniqueness by appending a numeric suffix if needed.
 */
async function uniqueSlug(baseSlug: string): Promise<string> {
  const existing = await listDirs(config.projectsDir);
  if (!existing.includes(baseSlug)) return baseSlug;

  let counter = 2;
  while (existing.includes(`${baseSlug}-${counter}`)) {
    counter++;
  }
  return `${baseSlug}-${counter}`;
}

// GET /hub/projects — list all projects
projects.get("/hub/projects", async (c) => {
  const slugs = await listDirs(config.projectsDir);
  const results: Project[] = [];

  for (const slug of slugs) {
    try {
      const project = await readJSON<Project>(projectJsonPath(slug));
      results.push(project);
    } catch {
      // skip corrupted or unreadable project dirs
    }
  }

  results.sort(
    (a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  return c.json(results);
});

// POST /hub/projects — create project
projects.post("/hub/projects", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateProjectBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      400
    );
  }

  const { name, description } = parsed.data;
  const baseSlug = generateSlug(name);
  if (!baseSlug) {
    return c.json({ error: "Name must produce a valid slug" }, 400);
  }

  const slug = await uniqueSlug(baseSlug);
  const now = new Date().toISOString();

  const project: Project = {
    id: randomUUID(),
    name,
    slug,
    description,
    created_at: now,
    updated_at: now,
    settings: {
      default_agent: "general",
      max_sources: 100,
      params: {},
    },
  };

  const dir = projectDir(slug);
  await ensureDir(dir);
  await ensureDir(path.join(dir, "sources"));
  await ensureDir(path.join(dir, "sessions"));
  await ensureDir(path.join(dir, "artifacts"));
  await writeJSON(projectJsonPath(slug), project);

  return c.json(project, 201);
});

// GET /hub/projects/:slug — get project
projects.get("/hub/projects/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const project = await readJSON<Project>(projectJsonPath(slug));
    return c.json(project);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return c.json({ error: "Project not found" }, 404);
    }
    throw err;
  }
});

// PATCH /hub/projects/:slug — update project
projects.patch("/hub/projects/:slug", async (c) => {
  const slug = c.req.param("slug");

  let existing: Project;
  try {
    existing = await readJSON<Project>(projectJsonPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return c.json({ error: "Project not found" }, 404);
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = UpdateProjectBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      400
    );
  }

  const updates = parsed.data;

  if (updates.name !== undefined) existing.name = updates.name;
  if (updates.description !== undefined) existing.description = updates.description;
  if (updates.settings) {
    if (updates.settings.default_agent !== undefined) {
      existing.settings.default_agent = updates.settings.default_agent;
    }
    if (updates.settings.max_sources !== undefined) {
      existing.settings.max_sources = updates.settings.max_sources;
    }
    if (updates.settings.context_budget !== undefined) {
      existing.settings.context_budget = updates.settings.context_budget;
    }
    if (updates.settings.params !== undefined) {
      existing.settings.params = updates.settings.params;
    }
  }
  existing.updated_at = new Date().toISOString();

  await writeJSON(projectJsonPath(slug), existing);

  return c.json(existing);
});

// DELETE /hub/projects/:slug — soft delete project
projects.delete("/hub/projects/:slug", async (c) => {
  const slug = c.req.param("slug");
  const dir = projectDir(slug);

  try {
    await readJSON<Project>(projectJsonPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return c.json({ error: "Project not found" }, 404);
    }
    throw err;
  }

  await moveToTrash(dir, config.dataDir);

  return c.body(null, 204);
});

export { projects };

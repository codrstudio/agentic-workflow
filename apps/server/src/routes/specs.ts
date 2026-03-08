import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  SpecDocumentSchema,
  SpecIndexSchema,
  CreateSpecDocumentBody,
  PatchSpecDocumentBody,
  type SpecDocument,
  type SpecIndex,
} from "../schemas/spec-document.js";
import { type Project } from "../schemas/project.js";

const specs = new Hono();

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

function specsDirPath(slug: string): string {
  return path.join(projectDir(slug), "specs");
}

function specPath(slug: string, id: string): string {
  return path.join(specsDirPath(slug), `${id}.json`);
}

function specIndexPath(slug: string): string {
  return path.join(projectDir(slug), "spec-index.json");
}

async function loadSpecIndex(slug: string): Promise<SpecIndex> {
  try {
    return await readJSON<SpecIndex>(specIndexPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return { slugs: [], next_number: 1 };
    }
    throw err;
  }
}

async function loadAllSpecs(slug: string): Promise<SpecDocument[]> {
  const dir = specsDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const result: SpecDocument[] = [];
  for (const file of files) {
    try {
      const s = await readJSON<SpecDocument>(path.join(dir, file));
      result.push(s);
    } catch {
      // skip malformed files
    }
  }
  return result;
}

// GET /hub/projects/:slug/specs
specs.get("/hub/projects/:slug/specs", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let all = await loadAllSpecs(slug);

  const statusFilter = c.req.query("status");
  const hasFeaturesFilter = c.req.query("has_features");
  const limitParam = c.req.query("limit");

  if (statusFilter) {
    all = all.filter((s) => s.status === statusFilter);
  }

  if (hasFeaturesFilter !== undefined) {
    const wantFeatures = hasFeaturesFilter === "true";
    all = all.filter((s) =>
      wantFeatures ? s.derived_features.length > 0 : s.derived_features.length === 0
    );
  }

  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  if (!isNaN(limit) && limit > 0) {
    all = all.slice(0, limit);
  }

  return c.json(all);
});

// POST /hub/projects/:slug/specs
specs.post("/hub/projects/:slug/specs", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json();
  const parsed = CreateSpecDocumentBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  // Auto-generate slug
  const index = await loadSpecIndex(slug);
  const num = index.next_number;
  const specSlug = `S-${String(num).padStart(3, "0")}`;

  const now = new Date().toISOString();
  const id = randomUUID();

  const doc: SpecDocument = SpecDocumentSchema.parse({
    id,
    project_id: project.id,
    slug: specSlug,
    title: parsed.data.title,
    status: parsed.data.status ?? "draft",
    version: 1,
    content_md: parsed.data.content_md ?? "",
    sections: parsed.data.sections ?? [],
    discoveries: parsed.data.discoveries ?? [],
    derived_features: parsed.data.derived_features ?? [],
    review_score: null,
    reviewed_by: [],
    superseded_by: null,
    tags: parsed.data.tags ?? [],
    created_at: now,
    updated_at: now,
  });

  await ensureDir(specsDirPath(slug));
  await writeJSON(specPath(slug, id), doc);

  // Update index
  const updatedIndex: SpecIndex = {
    slugs: [...index.slugs, specSlug],
    next_number: num + 1,
  };
  await writeJSON(specIndexPath(slug), updatedIndex);

  return c.json(doc, 201);
});

// GET /hub/projects/:slug/specs/:specId
specs.get("/hub/projects/:slug/specs/:specId", async (c) => {
  const slug = c.req.param("slug");
  const specId = c.req.param("specId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  try {
    const doc = await readJSON<SpecDocument>(specPath(slug, specId));
    return c.json(doc);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Spec not found" }, 404);
    throw err;
  }
});

// PATCH /hub/projects/:slug/specs/:specId
specs.patch("/hub/projects/:slug/specs/:specId", async (c) => {
  const slug = c.req.param("slug");
  const specId = c.req.param("specId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let existing: SpecDocument;
  try {
    existing = await readJSON<SpecDocument>(specPath(slug, specId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Spec not found" }, 404);
    throw err;
  }

  const body = await c.req.json();
  const parsed = PatchSpecDocumentBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  const updated: SpecDocument = {
    ...existing,
    ...parsed.data,
    version: existing.version + 1,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(specPath(slug, specId), updated);
  return c.json(updated);
});

export { specs };

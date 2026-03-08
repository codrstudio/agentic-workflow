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
  SpecReviewResultSchema,
  CreateSpecReviewBody,
  TriggerReviewBody,
  type SpecDocument,
  type SpecIndex,
  type SpecReviewResult,
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

function specReviewsDirPath(slug: string): string {
  return path.join(projectDir(slug), "spec-reviews");
}

function specReviewPath(slug: string, reviewId: string): string {
  return path.join(specReviewsDirPath(slug), `${reviewId}.json`);
}

async function loadSpecReviewsForSpec(slug: string, specId: string): Promise<SpecReviewResult[]> {
  const dir = specReviewsDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const result: SpecReviewResult[] = [];
  for (const file of files) {
    try {
      const r = await readJSON<SpecReviewResult>(path.join(dir, file));
      if (r.spec_id === specId) result.push(r);
    } catch {
      // skip malformed
    }
  }
  return result;
}

async function updateSpecReviewScore(slug: string, specId: string): Promise<void> {
  const sPath = specPath(slug, specId);
  let existing: SpecDocument;
  try {
    existing = await readJSON<SpecDocument>(sPath);
  } catch {
    return;
  }

  const reviews = await loadSpecReviewsForSpec(slug, specId);
  if (reviews.length === 0) return;

  const avg = Math.round(reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length);
  const reviewers = [...new Set(reviews.map((r) => r.reviewer))];

  const updated: SpecDocument = {
    ...existing,
    review_score: avg,
    reviewed_by: reviewers,
    updated_at: new Date().toISOString(),
  };
  await writeJSON(sPath, updated);
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

// GET /hub/projects/:slug/specs/:specId/reviews
specs.get("/hub/projects/:slug/specs/:specId/reviews", async (c) => {
  const slug = c.req.param("slug");
  const specId = c.req.param("specId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Verify spec exists
  try {
    await readJSON<SpecDocument>(specPath(slug, specId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Spec not found" }, 404);
    throw err;
  }

  const reviews = await loadSpecReviewsForSpec(slug, specId);
  return c.json(reviews);
});

// POST /hub/projects/:slug/specs/:specId/reviews
specs.post("/hub/projects/:slug/specs/:specId/reviews", async (c) => {
  const slug = c.req.param("slug");
  const specId = c.req.param("specId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Verify spec exists
  try {
    await readJSON<SpecDocument>(specPath(slug, specId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Spec not found" }, 404);
    throw err;
  }

  const body = await c.req.json();
  const parsed = CreateSpecReviewBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.flatten() }, 400);
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const review: SpecReviewResult = SpecReviewResultSchema.parse({
    id,
    project_id: project.id,
    spec_id: specId,
    reviewer: parsed.data.reviewer,
    score: parsed.data.score,
    verdict: parsed.data.verdict,
    comments: parsed.data.comments ?? [],
    created_at: now,
  });

  await ensureDir(specReviewsDirPath(slug));
  await writeJSON(specReviewPath(slug, id), review);

  // Update spec review_score and reviewed_by
  await updateSpecReviewScore(slug, specId);

  return c.json(review, 201);
});

// POST /hub/projects/:slug/specs/:specId/trigger-review
specs.post("/hub/projects/:slug/specs/:specId/trigger-review", async (c) => {
  const slug = c.req.param("slug");
  const specId = c.req.param("specId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let spec: SpecDocument;
  try {
    spec = await readJSON<SpecDocument>(specPath(slug, specId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Spec not found" }, 404);
    throw err;
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = TriggerReviewBody.safeParse(body);
  const agents = parsed.success ? parsed.data.agents : ["reviewer"];

  const now = new Date().toISOString();
  await ensureDir(specReviewsDirPath(slug));

  // Deterministic review generation per agent
  const verdicts: Array<"approve" | "request_changes" | "reject"> = ["approve", "request_changes", "reject"];
  const reviews: SpecReviewResult[] = [];

  for (let i = 0; i < agents.length; i++) {
    const agentName = agents[i] ?? "reviewer";
    const score = Math.min(100, Math.max(0, 70 + (i % 3) * 10));
    const verdict = score >= 80 ? "approve" : score >= 60 ? "request_changes" : "reject";
    const id = randomUUID();

    const review: SpecReviewResult = SpecReviewResultSchema.parse({
      id,
      project_id: project.id,
      spec_id: specId,
      reviewer: agentName,
      score,
      verdict,
      comments: [
        {
          section_anchor: "overview",
          comment: `Automated review by ${agentName}`,
          severity: "suggestion",
        },
      ],
      created_at: now,
    });

    await writeJSON(specReviewPath(slug, id), review);
    reviews.push(review);
  }

  // Update spec review_score with average of all reviews (including previous)
  await updateSpecReviewScore(slug, specId);

  void spec; // spec loaded to validate existence and for context
  return c.json({ accepted: true, reviews_queued: agents.length }, 202);
});

// GET /hub/projects/:slug/specs/:specId/context
specs.get("/hub/projects/:slug/specs/:specId/context", async (c) => {
  const slug = c.req.param("slug");
  const specId = c.req.param("specId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let spec: SpecDocument;
  try {
    spec = await readJSON<SpecDocument>(specPath(slug, specId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Spec not found" }, 404);
    throw err;
  }

  const reviews = await loadSpecReviewsForSpec(slug, specId);

  // Load related ACRs: read from acrs dir, return slugs of active ACRs
  const acrsDir = path.join(projectDir(slug), "acrs");
  const relatedAcrs: string[] = [];
  try {
    const { readdir: rd } = await import("node:fs/promises");
    const files = await rd(acrsDir);
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      try {
        const acr = await readJSON<{ slug?: string; status?: string }>(
          path.join(acrsDir, file)
        );
        if (acr.status === "active" && acr.slug) {
          relatedAcrs.push(acr.slug);
        }
      } catch {
        // skip
      }
    }
  } catch {
    // no acrs dir — return empty
  }

  return c.json({ spec, reviews, related_acrs: relatedAcrs });
});

export { specs };

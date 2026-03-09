import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ArchitecturalConstraintRecordSchema,
  ACRViolationSchema,
  ACRIndexSchema,
  CreateACRBody,
  PatchACRBody,
  CreateViolationBody,
  PatchViolationBody,
  type ArchitecturalConstraintRecord,
  type ACRViolation,
  type ACRIndex,
} from "../schemas/acr.js";
import { type Project } from "../schemas/project.js";

const acrs = new Hono();

// --- Directory helpers ---

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function acrsDir(slug: string): string {
  return path.join(projectDir(slug), "acrs");
}

function acrPath(slug: string, id: string): string {
  return path.join(acrsDir(slug), `${id}.json`);
}

function violationsDir(slug: string): string {
  return path.join(projectDir(slug), "acr-violations");
}

function violationsDayPath(slug: string, date: string): string {
  return path.join(violationsDir(slug), `${date}.json`);
}

function acrIndexPath(slug: string): string {
  return path.join(projectDir(slug), "acr-index.json");
}

// --- Project loading ---

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

// --- ACR index helpers ---

async function loadACRIndex(slug: string): Promise<ACRIndex> {
  try {
    const raw = await readJSON<unknown>(acrIndexPath(slug));
    const parsed = ACRIndexSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    return { slugs: [], next_number: 1 };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return { slugs: [], next_number: 1 };
    throw err;
  }
}

async function saveACRIndex(slug: string, index: ACRIndex): Promise<void> {
  await writeJSON(acrIndexPath(slug), index);
}

// --- ACR file helpers ---

async function loadACR(
  slug: string,
  id: string
): Promise<ArchitecturalConstraintRecord | null> {
  try {
    return await readJSON<ArchitecturalConstraintRecord>(acrPath(slug, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadAllACRs(
  slug: string
): Promise<ArchitecturalConstraintRecord[]> {
  const dir = acrsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const results: ArchitecturalConstraintRecord[] = [];
  for (const file of files) {
    try {
      const record = await readJSON<ArchitecturalConstraintRecord>(
        path.join(dir, file)
      );
      results.push(record);
    } catch {
      // skip malformed files
    }
  }
  return results;
}

// --- Violation file helpers ---

async function loadDayViolations(
  slug: string,
  date: string
): Promise<ACRViolation[]> {
  try {
    return await readJSON<ACRViolation[]>(violationsDayPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayViolations(
  slug: string,
  date: string,
  violations: ACRViolation[]
): Promise<void> {
  await writeJSON(violationsDayPath(slug, date), violations);
}

async function loadAllViolations(slug: string): Promise<ACRViolation[]> {
  const dir = violationsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: ACRViolation[] = [];
  for (const file of files) {
    try {
      const dayViolations = await readJSON<ACRViolation[]>(
        path.join(dir, file)
      );
      if (Array.isArray(dayViolations)) all.push(...dayViolations);
    } catch {
      // skip malformed files
    }
  }
  return all;
}

// --- Routes ---

// GET /hub/projects/:slug/acrs — list with optional ?status= and ?category= filters
acrs.get("/hub/projects/:slug/acrs", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const statusFilter = c.req.query("status");
  const categoryFilter = c.req.query("category");

  let records = await loadAllACRs(slug);

  if (statusFilter) {
    records = records.filter((r) => r.status === statusFilter);
  }
  if (categoryFilter) {
    records = records.filter((r) => r.category === categoryFilter);
  }

  records.sort((a, b) => a.slug.localeCompare(b.slug));

  return c.json(records);
});

// POST /hub/projects/:slug/acrs — create a new ACR with auto-incremented slug
acrs.post("/hub/projects/:slug/acrs", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateACRBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  // Load and update index atomically
  const index = await loadACRIndex(slug);
  const acrSlug = `ACR-${String(index.next_number).padStart(3, "0")}`;
  index.next_number++;
  index.slugs.push(acrSlug);

  const now = new Date().toISOString();
  const id = randomUUID();

  const record: ArchitecturalConstraintRecord = {
    id,
    project_id: slug,
    slug: acrSlug,
    title: parsed.data.title,
    category: parsed.data.category,
    status: parsed.data.status ?? "active",
    constraint: parsed.data.constraint,
    rationale: parsed.data.rationale,
    examples: parsed.data.examples,
    superseded_by: parsed.data.superseded_by ?? null,
    tags: parsed.data.tags ?? [],
    created_at: now,
    updated_at: now,
  };

  await ensureDir(acrsDir(slug));
  await writeJSON(acrPath(slug, id), record);
  await saveACRIndex(slug, index);

  return c.json(record, 201);
});

// GET /hub/projects/:slug/acrs/:acrId — get a single ACR (also handles /acrs/context)
acrs.get("/hub/projects/:slug/acrs/:acrId", async (c) => {
  const slug = c.req.param("slug");
  const acrId = c.req.param("acrId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  // Handle /acrs/context — active ACRs + violations summary
  if (acrId === "context") {
    const allACRs = await loadAllACRs(slug);
    const activeACRs = allACRs.filter((r) => r.status === "active");

    const allViolations = await loadAllViolations(slug);
    const activeAcrIds = new Set(activeACRs.map((a) => a.id));
    const relevantViolations = allViolations.filter((v) =>
      activeAcrIds.has(v.acr_id)
    );

    const open = relevantViolations.filter(
      (v) => v.resolution === "open"
    ).length;
    const accepted = relevantViolations.filter(
      (v) => v.resolution === "accepted"
    ).length;

    return c.json({
      acrs: activeACRs,
      violations_summary: { open, accepted },
    });
  }

  const record = await loadACR(slug, acrId);
  if (!record) return c.json({ error: "ACR not found" }, 404);

  return c.json(record);
});

// PATCH /hub/projects/:slug/acrs/:acrId — update an ACR
acrs.patch("/hub/projects/:slug/acrs/:acrId", async (c) => {
  const slug = c.req.param("slug");
  const acrId = c.req.param("acrId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const record = await loadACR(slug, acrId);
  if (!record) return c.json({ error: "ACR not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchACRBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const updated: ArchitecturalConstraintRecord = {
    ...record,
    ...parsed.data,
    id: record.id,
    slug: record.slug,
    project_id: record.project_id,
    created_at: record.created_at,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(acrPath(slug, acrId), updated);

  return c.json(updated);
});

// DELETE /hub/projects/:slug/acrs/:acrId — soft delete: set status to deprecated
acrs.delete("/hub/projects/:slug/acrs/:acrId", async (c) => {
  const slug = c.req.param("slug");
  const acrId = c.req.param("acrId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const record = await loadACR(slug, acrId);
  if (!record) return c.json({ error: "ACR not found" }, 404);

  const updated: ArchitecturalConstraintRecord = {
    ...record,
    status: "deprecated",
    updated_at: new Date().toISOString(),
  };

  await writeJSON(acrPath(slug, acrId), updated);

  return c.json(updated);
});

// GET /hub/projects/:slug/acrs/:acrId/violations — list violations for an ACR
acrs.get("/hub/projects/:slug/acrs/:acrId/violations", async (c) => {
  const slug = c.req.param("slug");
  const acrId = c.req.param("acrId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const record = await loadACR(slug, acrId);
  if (!record) return c.json({ error: "ACR not found" }, 404);

  const resolutionFilter = c.req.query("resolution");

  let violations = await loadAllViolations(slug);
  violations = violations.filter((v) => v.acr_id === acrId);

  if (resolutionFilter) {
    violations = violations.filter((v) => v.resolution === resolutionFilter);
  }

  violations.sort(
    (a, b) =>
      new Date(b.detected_at).getTime() - new Date(a.detected_at).getTime()
  );

  return c.json(violations);
});

// POST /hub/projects/:slug/acrs/:acrId/violations — register a violation
acrs.post("/hub/projects/:slug/acrs/:acrId/violations", async (c) => {
  const slug = c.req.param("slug");
  const acrId = c.req.param("acrId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const record = await loadACR(slug, acrId);
  if (!record) return c.json({ error: "ACR not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateViolationBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date();
  const violation: ACRViolation = {
    id: randomUUID(),
    project_id: slug,
    acr_id: acrId,
    acr_slug: record.slug,
    detected_at: now.toISOString(),
    context: parsed.data.context,
    description: parsed.data.description,
    artifact_id: parsed.data.artifact_id ?? null,
    feature_id: parsed.data.feature_id ?? null,
    resolution: parsed.data.resolution ?? "open",
    resolution_note: parsed.data.resolution_note,
    resolved_at: null,
  };

  const dateKey = now.toISOString().slice(0, 10);
  const dayViolations = await loadDayViolations(slug, dateKey);
  dayViolations.push(violation);
  await saveDayViolations(slug, dateKey, dayViolations);

  return c.json(violation, 201);
});

// PATCH /hub/projects/:slug/acr-violations/:violationId — resolve a violation
acrs.patch(
  "/hub/projects/:slug/acr-violations/:violationId",
  async (c) => {
    const slug = c.req.param("slug");
    const violationId = c.req.param("violationId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchViolationBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    // Search across all day files for this violation
    const dir = violationsDir(slug);
    let files: string[];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort().reverse();
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return c.json({ error: "Violation not found" }, 404);
      throw err;
    }

    for (const file of files) {
      const dateKey = file.replace(".json", "");
      const dayViolations = await loadDayViolations(slug, dateKey);
      const idx = dayViolations.findIndex((v) => v.id === violationId);
      if (idx !== -1) {
        const violation = dayViolations[idx]!;

        if (parsed.data.resolution !== undefined) {
          violation.resolution = parsed.data.resolution;
          // Auto-set resolved_at when resolution is not open
          if (
            parsed.data.resolution === "fixed" ||
            parsed.data.resolution === "accepted" ||
            parsed.data.resolution === "wontfix"
          ) {
            violation.resolved_at = new Date().toISOString();
          } else {
            // If re-opened, clear resolved_at
            violation.resolved_at = null;
          }
        }

        if (parsed.data.resolution_note !== undefined) {
          violation.resolution_note = parsed.data.resolution_note;
        }

        dayViolations[idx] = violation;
        await saveDayViolations(slug, dateKey, dayViolations);
        return c.json(violation);
      }
    }

    return c.json({ error: "Violation not found" }, 404);
  }
);

export { acrs };

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  MentoringProfileSchema,
  CreateMentoringProfileBody,
  PatchMentoringProfileBody,
  type MentoringProfile,
} from "../schemas/mentoring-profile.js";
import { type Project } from "../schemas/project.js";

const mentoringProfiles = new Hono();

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

function profilesDirPath(slug: string): string {
  return path.join(projectDir(slug), "mentoring-profiles");
}

function profilePath(slug: string, id: string): string {
  return path.join(profilesDirPath(slug), `${id}.json`);
}

async function loadAllProfiles(slug: string): Promise<MentoringProfile[]> {
  const dir = profilesDirPath(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const profiles: MentoringProfile[] = [];
  for (const file of files) {
    try {
      const p = await readJSON<MentoringProfile>(path.join(dir, file));
      profiles.push(p);
    } catch {
      // skip malformed files
    }
  }
  return profiles;
}

// GET /hub/projects/:slug/mentoring/profiles
mentoringProfiles.get("/hub/projects/:slug/mentoring/profiles", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const profiles = await loadAllProfiles(slug);
  return c.json(profiles);
});

// POST /hub/projects/:slug/mentoring/profiles
mentoringProfiles.post("/hub/projects/:slug/mentoring/profiles", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateMentoringProfileBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const data = parsed.data;

  const profile: MentoringProfile = {
    id,
    project_id: project.id,
    label: data.label,
    experience_level: data.experience_level,
    explanations_enabled: data.explanations_enabled ?? true,
    guided_mode: data.guided_mode ?? true,
    challenge_mode: data.challenge_mode ?? false,
    phases_completed: [],
    learning_notes: [],
    created_at: now,
    updated_at: now,
  };

  const validated = MentoringProfileSchema.safeParse(profile);
  if (!validated.success) {
    return c.json({ error: "Profile construction failed", details: validated.error.issues }, 500);
  }

  await ensureDir(profilesDirPath(slug));
  await writeJSON(profilePath(slug, id), validated.data);

  return c.json(validated.data, 201);
});

// GET /hub/projects/:slug/mentoring/profiles/:profileId
mentoringProfiles.get("/hub/projects/:slug/mentoring/profiles/:profileId", async (c) => {
  const slug = c.req.param("slug");
  const profileId = c.req.param("profileId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  try {
    const profile = await readJSON<MentoringProfile>(profilePath(slug, profileId));
    return c.json(profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Profile not found" }, 404);
    throw err;
  }
});

// PATCH /hub/projects/:slug/mentoring/profiles/:profileId
mentoringProfiles.patch("/hub/projects/:slug/mentoring/profiles/:profileId", async (c) => {
  const slug = c.req.param("slug");
  const profileId = c.req.param("profileId");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let existing: MentoringProfile;
  try {
    existing = await readJSON<MentoringProfile>(profilePath(slug, profileId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return c.json({ error: "Profile not found" }, 404);
    throw err;
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchMentoringProfileBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const data = parsed.data;
  const now = new Date().toISOString();

  // Build updated learning_notes
  let learningNotes = existing.learning_notes;
  if (data.add_learning_note) {
    learningNotes = [
      ...learningNotes,
      { ...data.add_learning_note, created_at: now },
    ];
  }

  // Build updated phases_completed (no duplicates)
  let phasesCompleted = existing.phases_completed;
  if (data.add_phase_completed && !phasesCompleted.includes(data.add_phase_completed)) {
    phasesCompleted = [...phasesCompleted, data.add_phase_completed];
  }

  const updated: MentoringProfile = {
    ...existing,
    ...(data.label !== undefined ? { label: data.label } : {}),
    ...(data.experience_level !== undefined ? { experience_level: data.experience_level } : {}),
    ...(data.explanations_enabled !== undefined ? { explanations_enabled: data.explanations_enabled } : {}),
    ...(data.guided_mode !== undefined ? { guided_mode: data.guided_mode } : {}),
    ...(data.challenge_mode !== undefined ? { challenge_mode: data.challenge_mode } : {}),
    learning_notes: learningNotes,
    phases_completed: phasesCompleted,
    updated_at: now,
  };

  await writeJSON(profilePath(slug, profileId), updated);
  return c.json(updated);
});

export { mentoringProfiles };

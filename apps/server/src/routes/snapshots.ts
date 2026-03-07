import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { type Project } from "../schemas/project.js";
import { type ChatSession } from "../schemas/session.js";
import { type Artifact } from "../schemas/artifact.js";
import { type Review } from "../schemas/review.js";

interface SnapshotSession {
  id: string;
  title: string;
  created_at: string;
  message_count: number;
  key_topics: string[];
}

interface SnapshotArtifact {
  id: string;
  title: string;
  type: string;
  updated_at: string;
}

interface SnapshotActiveSprint {
  number: number;
  current_phase: string;
  features_total: number;
  features_passing: number;
  features_failing: number;
  features_pending: number;
}

interface SnapshotReview {
  id: string;
  title: string;
  status: string;
  items_count: number;
}

interface ProjectSnapshot {
  id: string;
  project_id: string;
  created_at: string;
  summary: string;
  recent_sessions: SnapshotSession[];
  recent_artifacts: SnapshotArtifact[];
  active_sprint?: SnapshotActiveSprint;
  pending_reviews: SnapshotReview[];
  open_decisions: string[];
}

type SnapshotSummary = Pick<ProjectSnapshot, "id" | "project_id" | "created_at" | "active_sprint">;

const snapshots = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function snapshotsDir(slug: string): string {
  return path.join(projectDir(slug), "snapshots");
}

function latestPath(slug: string): string {
  return path.join(snapshotsDir(slug), "latest.json");
}

function snapshotPath(slug: string, id: string): string {
  return path.join(snapshotsDir(slug), `${id}.json`);
}

async function loadProject(slug: string): Promise<Project | null> {
  try {
    return await readJSON<Project>(
      path.join(projectDir(slug), "project.json"),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadSessions(slug: string): Promise<ChatSession[]> {
  const dir = path.join(projectDir(slug), "sessions");
  try {
    const files = await readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const sessions: ChatSession[] = [];
    for (const file of jsonFiles) {
      try {
        const session = await readJSON<ChatSession>(path.join(dir, file));
        sessions.push(session);
      } catch {
        // skip invalid files
      }
    }
    return sessions;
  } catch {
    return [];
  }
}

async function loadArtifacts(slug: string): Promise<Artifact[]> {
  try {
    return await readJSON<Artifact[]>(
      path.join(projectDir(slug), "artifacts", "artifacts.json"),
    );
  } catch {
    return [];
  }
}

async function loadReviews(slug: string): Promise<Review[]> {
  const dir = path.join(projectDir(slug), "reviews");
  try {
    const files = await readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));
    const reviews: Review[] = [];
    for (const file of jsonFiles) {
      try {
        const review = await readJSON<Review>(path.join(dir, file));
        reviews.push(review);
      } catch {
        // skip invalid files
      }
    }
    return reviews;
  } catch {
    return [];
  }
}

interface Feature {
  id: string;
  status: string;
}

async function loadFeatures(slug: string): Promise<{ sprintNumber: number; features: Feature[] } | null> {
  const sprintsRoot = path.join(projectDir(slug), "sprints");
  try {
    const dirs = await readdir(sprintsRoot);
    const sprintDirs = dirs
      .filter((d) => d.startsWith("sprint-"))
      .sort((a, b) => {
        const numA = parseInt(a.replace("sprint-", ""), 10);
        const numB = parseInt(b.replace("sprint-", ""), 10);
        return numB - numA; // highest first
      });

    for (const dir of sprintDirs) {
      const featuresPath = path.join(sprintsRoot, dir, "features.json");
      try {
        const features = await readJSON<Feature[]>(featuresPath);
        const num = parseInt(dir.replace("sprint-", ""), 10);
        return { sprintNumber: num, features };
      } catch {
        continue;
      }
    }
  } catch {
    // no sprints dir
  }
  return null;
}

function detectPhase(slug: string, sprintNumber: number): string {
  // Simple heuristic: check which phases have content
  return "development";
}

async function generateSnapshot(slug: string, projectId: string): Promise<ProjectSnapshot> {
  const id = randomUUID();
  const now = new Date().toISOString();

  // Load recent sessions (last 5)
  const allSessions = await loadSessions(slug);
  const sortedSessions = allSessions
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const recentSessions: SnapshotSession[] = sortedSessions.map((s) => ({
    id: s.id,
    title: s.title || "Sem titulo",
    created_at: s.created_at,
    message_count: s.messages?.length ?? 0,
    key_topics: [],
  }));

  // Load recent artifacts (last 10)
  const allArtifacts = await loadArtifacts(slug);
  const sortedArtifacts = allArtifacts
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 10);

  const recentArtifacts: SnapshotArtifact[] = sortedArtifacts.map((a) => ({
    id: a.id,
    title: a.name,
    type: a.type,
    updated_at: a.updated_at,
  }));

  // Load active sprint
  let activeSprint: SnapshotActiveSprint | undefined;
  const sprintData = await loadFeatures(slug);
  if (sprintData) {
    const { sprintNumber, features } = sprintData;
    activeSprint = {
      number: sprintNumber,
      current_phase: "development",
      features_total: features.length,
      features_passing: features.filter((f) => f.status === "passing").length,
      features_failing: features.filter((f) => f.status === "failing").length,
      features_pending: features.filter((f) =>
        f.status === "pending" || f.status === "blocked" || f.status === "in_progress",
      ).length,
    };
  }

  // Load pending reviews
  const allReviews = await loadReviews(slug);
  const pendingReviews: SnapshotReview[] = allReviews
    .filter((r) => r.status !== "approved")
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      title: r.title || `Review ${r.id.slice(0, 8)}`,
      status: r.status,
      items_count: r.items?.length ?? 0,
    }));

  const snapshot: ProjectSnapshot = {
    id,
    project_id: projectId,
    created_at: now,
    summary: "", // Will be populated by F-091 (AI summary generation)
    recent_sessions: recentSessions,
    recent_artifacts: recentArtifacts,
    active_sprint: activeSprint,
    pending_reviews: pendingReviews,
    open_decisions: [],
  };

  // Persist as {uuid}.json and latest.json
  await writeJSON(snapshotPath(slug, id), snapshot);
  await writeJSON(latestPath(slug), snapshot);

  return snapshot;
}

// POST /hub/projects/:slug/snapshots — generate new snapshot
snapshots.post("/hub/projects/:slug/snapshots", async (c) => {
  const slug = c.req.param("slug");

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const snapshot = await generateSnapshot(slug, project.id);
  return c.json(snapshot, 201);
});

// GET /hub/projects/:slug/snapshots/latest — get most recent snapshot
snapshots.get("/hub/projects/:slug/snapshots/latest", async (c) => {
  const slug = c.req.param("slug");

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  try {
    const snapshot = await readJSON<ProjectSnapshot>(latestPath(slug));
    return c.json(snapshot);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      return c.json({ error: "No snapshots found" }, 404);
    }
    throw err;
  }
});

// GET /hub/projects/:slug/snapshots — list snapshots (summarized)
snapshots.get("/hub/projects/:slug/snapshots", async (c) => {
  const slug = c.req.param("slug");

  const project = await loadProject(slug);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const limit = parseInt(c.req.query("limit") || "10", 10);
  const dir = snapshotsDir(slug);

  let files: string[];
  try {
    const allFiles = await readdir(dir);
    files = allFiles.filter((f) => f.endsWith(".json") && f !== "latest.json");
  } catch {
    return c.json([]);
  }

  // Load snapshots and sort by created_at desc
  const summaries: SnapshotSummary[] = [];
  for (const file of files) {
    try {
      const snapshot = await readJSON<ProjectSnapshot>(path.join(dir, file));
      summaries.push({
        id: snapshot.id,
        project_id: snapshot.project_id,
        created_at: snapshot.created_at,
        active_sprint: snapshot.active_sprint,
      });
    } catch {
      // skip invalid files
    }
  }

  summaries.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return c.json(summaries.slice(0, limit));
});

export { snapshots };

import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { spawnClaudeStream } from "../lib/claude-client.js";
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

async function detectPhase(slug: string, sprintNumber: number): Promise<string> {
  const sprintDir = path.join(projectDir(slug), "sprints", `sprint-${sprintNumber}`);
  // Check phases in reverse order (latest = current)
  const phases = [
    { dir: "3-prps", name: "development" },
    { dir: "2-specs", name: "specs" },
    { dir: "1-brainstorming", name: "brainstorming" },
  ];
  for (const phase of phases) {
    try {
      const files = await readdir(path.join(sprintDir, phase.dir));
      if (files.some((f) => f.endsWith(".md") || f.endsWith(".json"))) {
        return phase.name;
      }
    } catch {
      // dir doesn't exist
    }
  }
  return "planning";
}

/**
 * Extract key topics from session messages using simple keyword heuristic.
 * Looks at the last assistant message for subject keywords.
 */
function extractKeyTopics(session: ChatSession): string[] {
  if (!session.messages || session.messages.length === 0) return [];

  // Find last assistant messages to extract topics
  const assistantMessages = session.messages.filter((m) => m.role === "assistant");
  if (assistantMessages.length === 0) return [];

  const lastMsg = assistantMessages[assistantMessages.length - 1]!;
  const text = lastMsg.content;

  // Extract heading-like patterns and prominent nouns
  const topics: string[] = [];

  // Look for markdown headings
  const headingMatches = text.match(/^#{1,3}\s+(.+)$/gm);
  if (headingMatches) {
    for (const h of headingMatches.slice(0, 3)) {
      topics.push(h.replace(/^#+\s+/, "").trim());
    }
  }

  // If no headings, extract first sentence fragments as topics
  if (topics.length === 0) {
    const sentences = text.split(/[.!?\n]/).filter((s) => s.trim().length > 10);
    for (const s of sentences.slice(0, 3)) {
      const trimmed = s.trim();
      if (trimmed.length > 80) {
        topics.push(trimmed.slice(0, 77) + "...");
      } else {
        topics.push(trimmed);
      }
    }
  }

  return topics.slice(0, 5);
}

/**
 * Extract open decisions from recent sessions.
 * Looks for questions asked by the assistant that weren't followed by user responses.
 */
function extractOpenDecisions(sessions: ChatSession[]): string[] {
  const decisions: string[] = [];

  for (const session of sessions) {
    if (!session.messages || session.messages.length === 0) continue;

    // Check last few messages for unanswered assistant questions
    const msgs = session.messages;
    for (let i = msgs.length - 1; i >= Math.max(0, msgs.length - 5); i--) {
      const msg = msgs[i]!;
      if (msg.role !== "assistant") continue;

      // Check if this assistant message ends with a question and has no user reply after it
      const hasUserReplyAfter = msgs.slice(i + 1).some((m) => m.role === "user");
      if (hasUserReplyAfter) continue;

      // Extract questions from the message
      const questionLines = msg.content
        .split("\n")
        .filter((line) => line.trim().endsWith("?") && line.trim().length > 15);

      for (const q of questionLines.slice(0, 2)) {
        const trimmed = q.replace(/^[-*>•]\s*/, "").trim();
        if (trimmed.length > 120) {
          decisions.push(trimmed.slice(0, 117) + "...");
        } else {
          decisions.push(trimmed);
        }
      }
    }

    if (decisions.length >= 5) break;
  }

  return decisions.slice(0, 5);
}

/**
 * Generate a 3-5 sentence summary of the project state via Claude API.
 */
function generateSummaryViaClaudeAPI(snapshotData: Omit<ProjectSnapshot, "summary">): Promise<string> {
  return new Promise((resolve) => {
    const dataStr = JSON.stringify({
      recent_sessions: snapshotData.recent_sessions.map((s) => ({
        title: s.title,
        date: s.created_at,
        topics: s.key_topics,
      })),
      recent_artifacts: snapshotData.recent_artifacts.map((a) => ({
        title: a.title,
        type: a.type,
        updated: a.updated_at,
      })),
      active_sprint: snapshotData.active_sprint,
      pending_reviews: snapshotData.pending_reviews.map((r) => ({
        title: r.title,
        status: r.status,
      })),
      open_decisions: snapshotData.open_decisions,
    }, null, 2);

    const prompt = `Voce e um assistente de projeto. Baseado nos dados abaixo, gere um resumo conciso (3-5 frases) do estado atual do projeto, focando em:
1. O que foi feito recentemente
2. O que esta em progresso
3. O que precisa de atencao

Responda APENAS com o resumo em texto plano, sem markdown, sem prefixo.

Dados:
${dataStr}`;

    const timeoutId = setTimeout(() => {
      resolve("Resumo indisponivel — timeout na geracao via AI.");
    }, 30000);

    spawnClaudeStream(
      { prompt, maxTurns: 1 },
      {
        onDelta: () => {},
        onComplete: (fullText) => {
          clearTimeout(timeoutId);
          const trimmed = fullText.trim();
          resolve(trimmed || "Resumo indisponivel.");
        },
        onError: (err) => {
          clearTimeout(timeoutId);
          console.error("Claude summary generation failed:", err);
          resolve("Resumo indisponivel — falha na geracao via AI.");
        },
      },
    );
  });
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
    key_topics: extractKeyTopics(s),
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
    const currentPhase = await detectPhase(slug, sprintNumber);
    activeSprint = {
      number: sprintNumber,
      current_phase: currentPhase,
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

  // Extract open decisions from recent sessions
  const openDecisions = extractOpenDecisions(sortedSessions);

  // Build snapshot without summary first (for Claude prompt)
  const snapshotData = {
    id,
    project_id: projectId,
    created_at: now,
    recent_sessions: recentSessions,
    recent_artifacts: recentArtifacts,
    active_sprint: activeSprint,
    pending_reviews: pendingReviews,
    open_decisions: openDecisions,
  };

  // Generate summary via Claude API
  const summary = await generateSummaryViaClaudeAPI(snapshotData);

  const snapshot: ProjectSnapshot = {
    ...snapshotData,
    summary,
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

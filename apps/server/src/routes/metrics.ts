import { Hono } from "hono";
import path from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { readJSON, listDirs } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import type { ChatSession } from "../schemas/session.js";

const metrics = new Hono();

// --- Types ---

interface SpawnMeta {
  task: string;
  agent: string;
  wave: number;
  step: number;
  pid?: number;
  started_at?: string;
  finished_at?: string;
  exit_code?: number | null;
  timed_out?: boolean;
}

interface SessionMetrics {
  id: string;
  title: string;
  messages_count: number;
  tokens: number;
  cost_usd: number;
  duration_ms: number | null;
  last_message_at: string | null;
  created_at: string;
}

interface StepMetrics {
  wave: number;
  step: number;
  name: string;
  agent: string;
  duration_ms: number | null;
  exit_code: number | null;
  started_at: string | null;
  finished_at: string | null;
  tokens: number;
}

interface ProjectMetrics {
  total_tokens: number;
  total_cost_usd: number;
  total_sessions: number;
  total_features: number;
  features_passing: number;
  avg_session_tokens: number;
  avg_session_duration_ms: number | null;
}

// --- Helpers ---

// Claude pricing (Sonnet 4): ~$3/M input, ~$15/M output
// Simplified: average ~$6/M tokens for estimation
const COST_PER_TOKEN = 6 / 1_000_000;

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function sessionsDir(slug: string): string {
  return path.join(projectDir(slug), "sessions");
}

function workspaceDir(slug: string): string {
  return path.join(config.workspacesDir, slug);
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function loadProject(slug: string): Promise<boolean> {
  try {
    await readJSON(path.join(projectDir(slug), "project.json"));
    return true;
  } catch {
    return false;
  }
}

async function listSessionFiles(slug: string): Promise<string[]> {
  const dir = sessionsDir(slug);
  try {
    const entries = await readdir(dir);
    return entries.filter((e) => e.endsWith(".json"));
  } catch {
    return [];
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

async function buildSessionMetrics(slug: string): Promise<SessionMetrics[]> {
  const files = await listSessionFiles(slug);
  const result: SessionMetrics[] = [];

  for (const file of files) {
    try {
      const session = await readJSON<ChatSession>(
        path.join(sessionsDir(slug), file)
      );

      const messagesCount = session.messages.length;
      const tokens = session.messages.reduce(
        (sum, m) => sum + estimateTokens(m.content),
        0
      );

      const lastMsg =
        messagesCount > 0
          ? session.messages[messagesCount - 1]!
          : null;
      const firstMsg =
        messagesCount > 0 ? session.messages[0]! : null;

      let durationMs: number | null = null;
      if (firstMsg && lastMsg && messagesCount > 1) {
        durationMs =
          new Date(lastMsg.created_at).getTime() -
          new Date(firstMsg.created_at).getTime();
      }

      result.push({
        id: session.id,
        title: session.title,
        messages_count: messagesCount,
        tokens,
        cost_usd: parseFloat((tokens * COST_PER_TOKEN).toFixed(4)),
        duration_ms: durationMs,
        last_message_at: lastMsg?.created_at ?? null,
        created_at: session.created_at,
      });
    } catch {
      // skip corrupt files
    }
  }

  // Sort by last_message_at DESC
  result.sort((a, b) => {
    const aTime = a.last_message_at
      ? new Date(a.last_message_at).getTime()
      : 0;
    const bTime = b.last_message_at
      ? new Date(b.last_message_at).getTime()
      : 0;
    return bTime - aTime;
  });

  return result;
}

function parseStepDir(
  dirName: string
): { number: number; name: string } | null {
  const match = dirName.match(/^step-(\d+)-(.+)$/);
  if (!match) return null;
  return { number: parseInt(match[1]!, 10), name: match[2]! };
}

async function extractTokensFromJsonl(jsonlPath: string): Promise<number> {
  let content: string;
  try {
    content = await readFile(jsonlPath, "utf-8");
  } catch {
    return 0;
  }

  let totalTokens = 0;
  const lines = content.split("\n").filter((l) => l.trim() !== "");

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      // Extract usage from assistant messages in spawn.jsonl
      if (entry.type === "assistant" && entry.message) {
        const msg = entry.message as Record<string, unknown>;
        if (msg.usage) {
          const usage = msg.usage as Record<string, number>;
          totalTokens +=
            (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0);
        }
      }
    } catch {
      // skip unparseable lines
    }
  }

  return totalTokens;
}

async function buildStepMetrics(
  slug: string,
  waveFilter?: number
): Promise<StepMetrics[]> {
  const wsDir = workspaceDir(slug);
  if (!(await dirExists(wsDir))) return [];

  const allDirs = await listDirs(wsDir);
  const waveNumbers = allDirs
    .map((d) => {
      const m = d.match(/^wave-(\d+)$/);
      return m ? parseInt(m[1]!, 10) : null;
    })
    .filter((n): n is number => n !== null)
    .filter((n) => (waveFilter != null ? n === waveFilter : true))
    .sort((a, b) => a - b);

  const result: StepMetrics[] = [];

  for (const waveNum of waveNumbers) {
    const waveDir = path.join(wsDir, `wave-${waveNum}`);
    const dirs = await listDirs(waveDir);

    const stepDirs = dirs
      .map((d) => ({ dir: d, parsed: parseStepDir(d) }))
      .filter(
        (x): x is { dir: string; parsed: NonNullable<typeof x.parsed> } =>
          x.parsed !== null
      )
      .sort((a, b) => a.parsed.number - b.parsed.number);

    for (const { dir, parsed } of stepDirs) {
      const stepPath = path.join(waveDir, dir);
      let spawn: SpawnMeta | null = null;
      try {
        spawn = await readJSON<SpawnMeta>(path.join(stepPath, "spawn.json"));
      } catch {
        // no spawn.json
      }

      let durationMs: number | null = null;
      if (spawn?.started_at && spawn?.finished_at) {
        durationMs =
          new Date(spawn.finished_at).getTime() -
          new Date(spawn.started_at).getTime();
      }

      // Try to extract tokens from spawn.jsonl
      const tokens = await extractTokensFromJsonl(
        path.join(stepPath, "spawn.jsonl")
      );

      result.push({
        wave: waveNum,
        step: parsed.number,
        name: parsed.name,
        agent: spawn?.agent ?? "unknown",
        duration_ms: durationMs,
        exit_code: spawn?.exit_code ?? null,
        started_at: spawn?.started_at ?? null,
        finished_at: spawn?.finished_at ?? null,
        tokens,
      });
    }
  }

  return result;
}

interface Feature {
  id: string;
  status: string;
}

async function loadFeaturesCount(
  slug: string
): Promise<{ total: number; passing: number }> {
  const wsDir = workspaceDir(slug);
  if (!(await dirExists(wsDir))) return { total: 0, passing: 0 };

  // Find the repo dir and look for sprint features.json
  const repoDir = path.join(wsDir, "repo");
  if (!(await dirExists(repoDir))) return { total: 0, passing: 0 };

  const sprintsDir = path.join(repoDir, "sprints");
  if (!(await dirExists(sprintsDir))) return { total: 0, passing: 0 };

  const sprintDirs = await listDirs(sprintsDir);
  const sprintNumbers = sprintDirs
    .map((d) => {
      const m = d.match(/^sprint-(\d+)$/);
      return m ? parseInt(m[1]!, 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  let total = 0;
  let passing = 0;

  for (const num of sprintNumbers) {
    try {
      const features = await readJSON<Feature[]>(
        path.join(sprintsDir, `sprint-${num}`, "features.json")
      );
      total += features.length;
      passing += features.filter((f) => f.status === "passing").length;
    } catch {
      // skip
    }
  }

  return { total, passing };
}

// --- Endpoints ---

// GET /hub/projects/:slug/metrics — aggregate ProjectMetrics
metrics.get("/hub/projects/:slug/metrics", async (c) => {
  const slug = c.req.param("slug");
  const exists = await loadProject(slug);
  if (!exists) return c.json({ error: "Project not found" }, 404);

  const sessionMetrics = await buildSessionMetrics(slug);
  const { total: totalFeatures, passing: featuresPass } =
    await loadFeaturesCount(slug);

  const totalTokens = sessionMetrics.reduce((s, m) => s + m.tokens, 0);
  const totalCost = sessionMetrics.reduce((s, m) => s + m.cost_usd, 0);
  const totalSessions = sessionMetrics.length;

  const durations = sessionMetrics
    .map((m) => m.duration_ms)
    .filter((d): d is number => d !== null);
  const avgDuration =
    durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null;

  const result: ProjectMetrics = {
    total_tokens: totalTokens,
    total_cost_usd: parseFloat(totalCost.toFixed(4)),
    total_sessions: totalSessions,
    total_features: totalFeatures,
    features_passing: featuresPass,
    avg_session_tokens:
      totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
    avg_session_duration_ms: avgDuration,
  };

  return c.json(result);
});

// GET /hub/projects/:slug/metrics/sessions — list SessionMetrics
metrics.get("/hub/projects/:slug/metrics/sessions", async (c) => {
  const slug = c.req.param("slug");
  const exists = await loadProject(slug);
  if (!exists) return c.json({ error: "Project not found" }, 404);

  const sessionMetrics = await buildSessionMetrics(slug);
  return c.json(sessionMetrics);
});

// GET /hub/projects/:slug/metrics/steps?wave=N — list StepMetrics
metrics.get("/hub/projects/:slug/metrics/steps", async (c) => {
  const slug = c.req.param("slug");
  const exists = await loadProject(slug);
  if (!exists) return c.json({ error: "Project not found" }, 404);

  const waveParam = c.req.query("wave");
  const waveFilter = waveParam ? parseInt(waveParam, 10) : undefined;
  if (waveParam && (isNaN(waveFilter!) || waveFilter! < 1)) {
    return c.json({ error: "Invalid wave parameter" }, 400);
  }

  const stepMetrics = await buildStepMetrics(slug, waveFilter);
  return c.json(stepMetrics);
});

export { metrics };

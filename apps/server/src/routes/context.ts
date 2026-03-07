import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { type Source } from "../schemas/source.js";
import { type Project } from "../schemas/project.js";
import { type ChatSession } from "../schemas/session.js";

const context = new Hono();

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
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

async function loadSources(slug: string): Promise<Source[]> {
  try {
    return await readJSON<Source[]>(
      path.join(projectDir(slug), "sources", "sources.json")
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function loadSession(
  slug: string,
  id: string
): Promise<ChatSession | null> {
  try {
    return await readJSON<ChatSession>(
      path.join(projectDir(slug), "sessions", `${id}.json`)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

interface UsageLogEntry {
  source_id: string;
  included: boolean;
  tokens_used: number;
  referenced_in_response: boolean;
}

interface UsageLogFile {
  session_id: string;
  entries: UsageLogEntry[];
}

function usageLogsDir(slug: string): string {
  return path.join(projectDir(slug), "context", "usage-logs");
}

async function loadAllUsageLogs(slug: string): Promise<UsageLogFile[]> {
  const dir = usageLogsDir(slug);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const logs: UsageLogFile[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const data = await readJSON<UsageLogFile>(path.join(dir, file));
      logs.push(data);
    } catch {
      // skip corrupt files
    }
  }
  return logs;
}

interface SourceUsageStats {
  timesIncluded: number;
  timesReferenced: number;
  totalSessions: number;
}

function computeUsageStats(
  logs: UsageLogFile[]
): Map<string, SourceUsageStats> {
  const stats = new Map<string, SourceUsageStats>();
  const totalSessions = logs.length;

  for (const log of logs) {
    for (const entry of log.entries) {
      let s = stats.get(entry.source_id);
      if (!s) {
        s = { timesIncluded: 0, timesReferenced: 0, totalSessions };
        stats.set(entry.source_id, s);
      }
      if (entry.included) s.timesIncluded++;
      if (entry.referenced_in_response) s.timesReferenced++;
    }
  }

  // Ensure totalSessions is set on all entries
  for (const s of stats.values()) {
    s.totalSessions = totalSessions;
  }

  return stats;
}

// Category-to-task_type relevance mapping
const CATEGORY_TASK_RELEVANCE: Record<string, string[]> = {
  frontend: ["refactoring", "ui", "styling", "component", "layout"],
  backend: ["api", "database", "migration", "refactoring", "performance"],
  business: ["planning", "review", "analysis", "specification"],
  reference: ["research", "review", "analysis", "documentation"],
  config: ["deployment", "infrastructure", "configuration", "ci"],
  general: [],
};

function computeCategoryScore(
  category: string,
  taskType: string | undefined
): number {
  if (!taskType) return 0;
  const relevantTasks = CATEGORY_TASK_RELEVANCE[category] ?? [];
  const normalizedTask = taskType.toLowerCase();
  return relevantTasks.some((t) => normalizedTask.includes(t)) ? 0.3 : 0;
}

function computeTagScore(
  relevanceTags: string[],
  keywords: string[]
): number {
  if (relevanceTags.length === 0 || keywords.length === 0) return 0;

  const normalizedTags = relevanceTags.map((t) => t.toLowerCase());
  const normalizedKeywords = keywords.map((k) => k.toLowerCase());

  let matches = 0;
  for (const tag of normalizedTags) {
    if (normalizedKeywords.some((kw) => tag.includes(kw) || kw.includes(tag))) {
      matches++;
    }
  }

  if (matches === 0) return 0;
  return Math.min(matches / normalizedTags.length, 1) * 0.3;
}

function computeUsageScore(stats: SourceUsageStats | undefined): number {
  if (!stats || stats.totalSessions === 0) return 0;
  const frequency = stats.timesIncluded / stats.totalSessions;
  return frequency * 0.4; // max 0.4
}

function generateReason(
  usageStats: SourceUsageStats | undefined,
  categoryScore: number,
  tagScore: number
): string {
  const parts: string[] = [];

  if (usageStats && usageStats.timesIncluded > 0) {
    parts.push(
      `Usado em ${usageStats.timesIncluded} de ${usageStats.totalSessions} sessoes`
    );
  }

  if (categoryScore > 0) {
    parts.push("Categoria relevante para o tipo de tarefa");
  }

  if (tagScore > 0) {
    parts.push("Tags correspondem as keywords");
  }

  if (parts.length === 0) {
    return "Sem historico de uso";
  }

  return parts.join(". ");
}

interface RecommendedSource {
  source_id: string;
  name: string;
  relevance: number;
  reason: string;
}

// GET /hub/projects/:slug/sessions/:sessionId/recommended-sources
context.get(
  "/hub/projects/:slug/sessions/:sessionId/recommended-sources",
  async (c) => {
    const slug = c.req.param("slug");
    const sessionId = c.req.param("sessionId");
    const taskType = c.req.query("task_type");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const session = await loadSession(slug, sessionId);
    if (!session) return c.json({ error: "Session not found" }, 404);

    const allSources = await loadSources(slug);
    const usageLogs = await loadAllUsageLogs(slug);
    const usageStatsMap = computeUsageStats(usageLogs);

    // Extract keywords from recent user messages in this session
    const keywords = extractKeywords(session);

    const recommended: RecommendedSource[] = allSources.map((source) => {
      const stats = usageStatsMap.get(source.id);
      const usageScore = computeUsageScore(stats);
      const categoryScore = computeCategoryScore(
        source.category ?? "general",
        taskType
      );
      const tagScore = computeTagScore(
        source.relevance_tags ?? [],
        keywords
      );

      const relevance = Math.min(usageScore + categoryScore + tagScore, 1);
      const reason = generateReason(stats, categoryScore, tagScore);

      return {
        source_id: source.id,
        name: source.name,
        relevance: Math.round(relevance * 1000) / 1000,
        reason,
      };
    });

    // Sort by relevance descending
    recommended.sort((a, b) => b.relevance - a.relevance);

    return c.json({ sources: recommended });
  }
);

function extractKeywords(session: ChatSession): string[] {
  // Extract significant words from user messages
  const userMessages = session.messages
    .filter((m) => m.role === "user")
    .slice(-5); // last 5 messages

  const words = new Set<string>();
  for (const msg of userMessages) {
    const tokens = msg.content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3); // skip short words
    for (const t of tokens) {
      words.add(t);
    }
  }

  return Array.from(words);
}

export { context };

import { Hono } from "hono";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
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

// POST /hub/projects/:slug/context/usage-logs
context.post("/hub/projects/:slug/context/usage-logs", async (c) => {
  const slug = c.req.param("slug");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const body = await c.req.json<{
    session_id: string;
    entries: UsageLogEntry[];
  }>();

  if (!body.session_id || !Array.isArray(body.entries)) {
    return c.json(
      { error: "session_id and entries[] are required" },
      400
    );
  }

  const logData: UsageLogFile = {
    session_id: body.session_id,
    entries: body.entries,
  };

  const dir = usageLogsDir(slug);
  await ensureDir(dir);
  await writeJSON(path.join(dir, `${body.session_id}.json`), logData);

  return c.json(logData, 201);
});

// GET /hub/projects/:slug/context/metrics
context.get("/hub/projects/:slug/context/metrics", async (c) => {
  const slug = c.req.param("slug");

  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const logs = await loadAllUsageLogs(slug);

  if (logs.length === 0) {
    return c.json({
      avg_context_tokens: 0,
      avg_sources_per_session: 0,
      effectiveness_ratio: {},
      category_distribution: {},
      total_sessions: 0,
    });
  }

  // Compute avg tokens and avg sources per session
  let totalTokens = 0;
  let totalSourcesIncluded = 0;

  for (const log of logs) {
    for (const entry of log.entries) {
      if (entry.included) {
        totalTokens += entry.tokens_used;
        totalSourcesIncluded++;
      }
    }
  }

  const avgContextTokens = Math.round(totalTokens / logs.length);
  const avgSourcesPerSession = Math.round((totalSourcesIncluded / logs.length) * 100) / 100;

  // Compute effectiveness ratio per source
  const sourceStats = new Map<
    string,
    { included: number; referenced: number; category: string }
  >();

  // Load sources to get categories
  const allSources = await loadSources(slug);
  const sourceMap = new Map(allSources.map((s) => [s.id, s]));

  for (const log of logs) {
    for (const entry of log.entries) {
      let s = sourceStats.get(entry.source_id);
      if (!s) {
        const source = sourceMap.get(entry.source_id);
        s = { included: 0, referenced: 0, category: source?.category ?? "general" };
        sourceStats.set(entry.source_id, s);
      }
      if (entry.included) s.included++;
      if (entry.referenced_in_response) s.referenced++;
    }
  }

  const effectivenessRatio: Record<
    string,
    { included: number; referenced: number; ratio: number }
  > = {};
  for (const [sourceId, stats] of sourceStats) {
    effectivenessRatio[sourceId] = {
      included: stats.included,
      referenced: stats.referenced,
      ratio:
        stats.included > 0
          ? Math.round((stats.referenced / stats.included) * 1000) / 1000
          : 0,
    };
  }

  // Category distribution with avg tokens
  const categoryTokens = new Map<
    string,
    { totalTokens: number; count: number }
  >();

  for (const log of logs) {
    for (const entry of log.entries) {
      if (!entry.included) continue;
      const source = sourceMap.get(entry.source_id);
      const cat = source?.category ?? "general";
      let c2 = categoryTokens.get(cat);
      if (!c2) {
        c2 = { totalTokens: 0, count: 0 };
        categoryTokens.set(cat, c2);
      }
      c2.totalTokens += entry.tokens_used;
      c2.count++;
    }
  }

  const categoryDistribution: Record<
    string,
    { avg_tokens: number; total_tokens: number; count: number }
  > = {};
  for (const [cat, data] of categoryTokens) {
    categoryDistribution[cat] = {
      avg_tokens: Math.round(data.totalTokens / data.count),
      total_tokens: data.totalTokens,
      count: data.count,
    };
  }

  // Per-session breakdown for bar chart (tokens by category per session)
  const sessionBreakdown: Array<{
    session_id: string;
    total_tokens: number;
    by_category: Record<string, number>;
  }> = [];

  for (const log of logs) {
    const byCat: Record<string, number> = {};
    let total = 0;
    for (const entry of log.entries) {
      if (!entry.included) continue;
      const source = sourceMap.get(entry.source_id);
      const cat = source?.category ?? "general";
      byCat[cat] = (byCat[cat] ?? 0) + entry.tokens_used;
      total += entry.tokens_used;
    }
    sessionBreakdown.push({
      session_id: log.session_id,
      total_tokens: total,
      by_category: byCat,
    });
  }

  // Source effectiveness list for the table
  const sourceEffectiveness: Array<{
    source_id: string;
    name: string;
    category: string;
    included: number;
    referenced: number;
    ratio: number;
  }> = [];

  for (const [sourceId, stats] of sourceStats) {
    const source = sourceMap.get(sourceId);
    const ratio = stats.included > 0
      ? Math.round((stats.referenced / stats.included) * 1000) / 1000
      : 0;
    sourceEffectiveness.push({
      source_id: sourceId,
      name: source?.name ?? sourceId,
      category: stats.category,
      included: stats.included,
      referenced: stats.referenced,
      ratio,
    });
  }

  sourceEffectiveness.sort((a, b) => a.ratio - b.ratio);

  return c.json({
    avg_context_tokens: avgContextTokens,
    avg_sources_per_session: avgSourcesPerSession,
    effectiveness_ratio: effectivenessRatio,
    category_distribution: categoryDistribution,
    total_sessions: logs.length,
    session_breakdown: sessionBreakdown,
    source_effectiveness: sourceEffectiveness,
  });
});

// --- F-066: Source compression API ---

async function loadContentForSource(
  slug: string,
  source: Source
): Promise<string | undefined> {
  if (source.content !== undefined) return source.content;
  if (source.file_path) {
    const fullPath = path.join(projectDir(slug), "sources", source.file_path);
    try {
      return await readFile(fullPath, "utf-8");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

type MarkdownBlock =
  | { type: "heading"; content: string }
  | { type: "code_block"; content: string }
  | { type: "table"; content: string }
  | { type: "list"; content: string }
  | { type: "paragraph"; content: string };

function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const lines = markdown.split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Empty line — skip
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    if (/^#{1,6}\s/.test(line)) {
      blocks.push({ type: "heading", content: line });
      i++;
      continue;
    }

    // Fenced code block
    if (/^```/.test(line.trimStart())) {
      const codeLines: string[] = [line];
      i++;
      while (i < lines.length) {
        codeLines.push(lines[i]!);
        if (/^```/.test(lines[i]!.trimStart()) && codeLines.length > 1) {
          i++;
          break;
        }
        i++;
      }
      blocks.push({ type: "code_block", content: codeLines.join("\n") });
      continue;
    }

    // Table (line starts with |)
    if (line.trimStart().startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trimStart().startsWith("|")) {
        tableLines.push(lines[i]!);
        i++;
      }
      blocks.push({ type: "table", content: tableLines.join("\n") });
      continue;
    }

    // List item (unordered: - or *, ordered: 1.)
    if (/^(\s{0,3}[-*+]|\s{0,3}\d+\.)\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length) {
        const l = lines[i]!;
        // Continue list: list item or continuation (indented) or empty line between items
        if (/^(\s{0,3}[-*+]|\s{0,3}\d+\.)\s/.test(l)) {
          listLines.push(l);
          i++;
        } else if (l.trim() === "" && i + 1 < lines.length && /^(\s{0,3}[-*+]|\s{0,3}\d+\.)\s/.test(lines[i + 1]!)) {
          listLines.push(l);
          i++;
        } else {
          break;
        }
      }
      blocks.push({ type: "list", content: listLines.join("\n") });
      continue;
    }

    // Paragraph (everything else)
    const paraLines: string[] = [];
    while (i < lines.length) {
      const l = lines[i]!;
      if (l.trim() === "") { i++; break; }
      if (/^#{1,6}\s/.test(l)) break;
      if (/^```/.test(l.trimStart())) break;
      if (l.trimStart().startsWith("|")) break;
      if (/^(\s{0,3}[-*+]|\s{0,3}\d+\.)\s/.test(l)) break;
      paraLines.push(l);
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: "paragraph", content: paraLines.join("\n") });
    }
  }

  return blocks;
}

function compressMarkdown(markdown: string, targetTokens?: number): {
  compressed_content: string;
  original_tokens: number;
  compressed_tokens: number;
} {
  const originalTokens = estimateTokens(markdown);
  const blocks = parseMarkdownBlocks(markdown);

  // Keep headings, code blocks, tables, lists; discard paragraphs
  const kept = blocks.filter((b) => b.type !== "paragraph");
  let compressed = kept.map((b) => b.content).join("\n\n");

  let compressedTokens = estimateTokens(compressed);

  // If target_tokens specified and we're still over, truncate
  if (targetTokens !== undefined && targetTokens > 0 && compressedTokens > targetTokens) {
    const targetChars = targetTokens * 4;
    compressed = compressed.slice(0, targetChars);
    compressedTokens = estimateTokens(compressed);
  }

  return {
    compressed_content: compressed,
    original_tokens: originalTokens,
    compressed_tokens: compressedTokens,
  };
}

// POST /hub/projects/:slug/sources/:sourceId/compress
context.post(
  "/hub/projects/:slug/sources/:sourceId/compress",
  async (c) => {
    const slug = c.req.param("slug");
    const sourceId = c.req.param("sourceId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const allSources = await loadSources(slug);
    const source = allSources.find((s) => s.id === sourceId);
    if (!source) return c.json({ error: "Source not found" }, 404);

    const content = await loadContentForSource(slug, source);
    if (content === undefined || content === "") {
      return c.json({ error: "Source has no content" }, 400);
    }

    let targetTokens: number | undefined;
    try {
      const body = await c.req.json<{ target_tokens?: number }>();
      if (body.target_tokens !== undefined) {
        targetTokens = body.target_tokens;
      }
    } catch {
      // No body or invalid JSON — that's fine, target_tokens is optional
    }

    const result = compressMarkdown(content, targetTokens);

    return c.json(result);
  }
);

export { context };

import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { spawnClaudeStream } from "../lib/claude-client.js";
import {
  AnalyzeDensityBodySchema,
  type SourceDensityMetrics,
} from "../schemas/source-density.js";
import { type Source } from "../schemas/source.js";
import { type Project } from "../schemas/project.js";
import { type ContextProfile } from "../schemas/context-profile.js";

const contextDensity = new Hono();

// ---- helpers ----

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function densityDir(slug: string): string {
  return path.join(projectDir(slug), "context", "density");
}

function densityPath(slug: string, sourceId: string): string {
  return path.join(densityDir(slug), `${sourceId}.json`);
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
    const raw = await readJSON<Record<string, unknown>[]>(
      path.join(projectDir(slug), "sources", "sources.json")
    );
    return raw.map((s) => ({
      ...s,
      category: s["category"] ?? "general",
      pinned: s["pinned"] ?? false,
      auto_include: s["auto_include"] ?? false,
      relevance_tags: s["relevance_tags"] ?? [],
    })) as Source[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function loadProfile(
  slug: string,
  profileId: string
): Promise<ContextProfile | null> {
  try {
    return await readJSON<ContextProfile>(
      path.join(projectDir(slug), "context", "profiles", `${profileId}.json`)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadDensityMetrics(
  slug: string,
  sourceId: string
): Promise<SourceDensityMetrics | null> {
  try {
    return await readJSON<SourceDensityMetrics>(densityPath(slug, sourceId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveDensityMetrics(
  slug: string,
  metrics: SourceDensityMetrics
): Promise<void> {
  await ensureDir(densityDir(slug));
  await writeJSON(densityPath(slug, metrics.source_id), metrics);
}

/**
 * Compute freshness based on source updated_at timestamp.
 * current: updated within 7 days
 * stale: 7-30 days
 * outdated: older than 30 days
 */
function computeFreshness(
  updatedAt: string
): "current" | "stale" | "outdated" {
  const now = Date.now();
  const updated = new Date(updatedAt).getTime();
  const diffDays = (now - updated) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return "current";
  if (diffDays <= 30) return "stale";
  return "outdated";
}

/**
 * Heuristic metrics for a single source without Claude.
 */
function computeHeuristicMetrics(
  source: Source,
  allSources: Source[]
): Omit<SourceDensityMetrics, "computed_at"> {
  const tokenCount = Math.ceil(source.size_bytes / 4);

  // information_density: inverse of token count relative to a reference (higher tokens = potentially lower density)
  // Base 80, penalize very large sources
  let informationDensity = 80;
  if (tokenCount > 8000) informationDensity -= 30;
  else if (tokenCount > 4000) informationDensity -= 15;
  else if (tokenCount < 100) informationDensity -= 20; // very small = low info
  informationDensity = Math.max(10, Math.min(100, informationDensity));

  // redundancy_score: check for name similarity with other sources
  const nameLower = source.name.toLowerCase();
  let redundancyScore = 0;
  for (const other of allSources) {
    if (other.id === source.id) continue;
    const otherNameLower = other.name.toLowerCase();
    // Simple overlap: check if one name contains the other
    if (
      nameLower.includes(otherNameLower.slice(0, 10)) ||
      otherNameLower.includes(nameLower.slice(0, 10))
    ) {
      redundancyScore += 20;
    }
    // Same category increases potential redundancy
    if (other.category === source.category) {
      redundancyScore += 5;
    }
  }
  redundancyScore = Math.min(90, redundancyScore);

  // relevance_score: based on tags and category completeness
  let relevanceScore = 60;
  if (source.relevance_tags && source.relevance_tags.length > 0) relevanceScore += 15;
  if (source.tags && source.tags.length > 2) relevanceScore += 10;
  if (source.pinned) relevanceScore += 10;
  if (source.auto_include) relevanceScore += 5;
  relevanceScore = Math.min(100, relevanceScore);

  const freshness = computeFreshness(source.updated_at);

  // Build recommendations
  const recommendations: SourceDensityMetrics["recommendations"] = [];

  if (tokenCount > 8000) {
    recommendations.push({
      type: "split",
      reason: `Source is large (${tokenCount} tokens). Consider splitting into focused sub-topics.`,
      target_source_id: null,
    });
  }
  if (redundancyScore > 40) {
    // Find most similar source
    const similar = allSources.find(
      (s) =>
        s.id !== source.id &&
        s.category === source.category &&
        s.name.toLowerCase().includes(source.name.slice(0, 8).toLowerCase())
    );
    recommendations.push({
      type: "merge",
      reason: `High redundancy (${redundancyScore}%) with other sources in the same category.`,
      target_source_id: similar?.id ?? null,
    });
  }
  if (freshness === "outdated") {
    recommendations.push({
      type: "update",
      reason: "Source has not been updated in over 30 days and may be outdated.",
      target_source_id: null,
    });
  }
  if (tokenCount < 100 && source.size_bytes > 0) {
    recommendations.push({
      type: "summarize",
      reason: "Source has minimal content. Consider summarizing into a parent document.",
      target_source_id: null,
    });
  }
  if (relevanceScore < 40) {
    recommendations.push({
      type: "remove",
      reason: "Source has low relevance score and few tags. Consider removing.",
      target_source_id: null,
    });
  }

  return {
    source_id: source.id,
    project_id: source.project_id,
    token_count: tokenCount,
    information_density: informationDensity,
    redundancy_score: redundancyScore,
    relevance_score: relevanceScore,
    freshness,
    usage_count: 0,
    last_used_at: null,
    recommendations,
  };
}

/**
 * Call Claude Haiku to evaluate density and redundancy for a set of sources.
 * Returns a map of source_id -> { information_density, redundancy_score, relevance_score, recommendations }
 */
async function analyzeWithClaude(
  sources: Source[]
): Promise<
  Map<
    string,
    {
      information_density: number;
      redundancy_score: number;
      relevance_score: number;
      recommendations: SourceDensityMetrics["recommendations"];
    }
  >
> {
  const summaries = sources.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    size_bytes: s.size_bytes,
    token_count_estimate: Math.ceil(s.size_bytes / 4),
    tags: s.tags,
    relevance_tags: s.relevance_tags,
  }));

  const prompt = `You are a context engineering analyst. Evaluate the following document sources for a software project.

Sources (JSON):
${JSON.stringify(summaries, null, 2)}

For each source, provide a JSON analysis. Respond ONLY with a valid JSON array, no other text:
[
  {
    "source_id": "<uuid>",
    "information_density": <0-100, higher means more dense/useful info per token>,
    "redundancy_score": <0-100, higher means more redundant with other sources>,
    "relevance_score": <0-100, higher means more relevant to the project>,
    "recommendations": [
      {
        "type": "<split|merge|remove|update|summarize>",
        "reason": "<brief explanation>",
        "target_source_id": "<uuid or null>"
      }
    ]
  }
]

Rules:
- information_density: high for focused technical docs, low for verbose/unfocused content
- redundancy_score: check name similarity, category overlap, and likely content overlap
- relevance_score: based on tags, category, and apparent purpose
- Only add recommendations if clearly warranted
- target_source_id for merge recommendations should reference another source in the list, or null`;

  return new Promise((resolve) => {
    const results = new Map<
      string,
      {
        information_density: number;
        redundancy_score: number;
        relevance_score: number;
        recommendations: SourceDensityMetrics["recommendations"];
      }
    >();

    let fullText = "";
    const timeout = setTimeout(() => {
      // Timeout: return empty map, caller falls back to heuristics
      resolve(results);
    }, 30000);

    spawnClaudeStream(
      {
        prompt,
        model: "claude-haiku-4-5-20251001",
        maxTurns: 1,
        allowedTools: [],
      },
      {
        onDelta: (text) => {
          fullText += text;
        },
        onComplete: (text) => {
          clearTimeout(timeout);
          try {
            // Extract JSON array from response
            const match = text.match(/\[[\s\S]*\]/);
            if (!match) {
              resolve(results);
              return;
            }
            const parsed = JSON.parse(match[0]) as Array<{
              source_id: string;
              information_density: number;
              redundancy_score: number;
              relevance_score: number;
              recommendations: Array<{
                type: string;
                reason: string;
                target_source_id: string | null;
              }>;
            }>;

            for (const item of parsed) {
              const validTypes = new Set([
                "split",
                "merge",
                "remove",
                "update",
                "summarize",
              ]);
              const recommendations = (item.recommendations ?? [])
                .filter((r) => validTypes.has(r.type))
                .map((r) => ({
                  type: r.type as
                    | "split"
                    | "merge"
                    | "remove"
                    | "update"
                    | "summarize",
                  reason: r.reason ?? "",
                  target_source_id: r.target_source_id ?? null,
                }));

              results.set(item.source_id, {
                information_density: Math.min(
                  100,
                  Math.max(0, Math.round(item.information_density ?? 70))
                ),
                redundancy_score: Math.min(
                  100,
                  Math.max(0, Math.round(item.redundancy_score ?? 10))
                ),
                relevance_score: Math.min(
                  100,
                  Math.max(0, Math.round(item.relevance_score ?? 60))
                ),
                recommendations,
              });
            }
          } catch {
            // JSON parse failed
          }
          resolve(results);
        },
        onError: () => {
          clearTimeout(timeout);
          resolve(results);
        },
      }
    );

    // Suppress unused variable warning
    void fullText;
  });
}

// ---- routes ----

// GET /hub/projects/:projectId/context/density
// Optional query: ?profile_id=<uuid>
contextDensity.get(
  "/hub/projects/:projectId/context/density",
  async (c) => {
    const slug = c.req.param("projectId");
    const profileId = c.req.query("profile_id");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let sources = await loadSources(slug);

    // Filter by profile if provided
    if (profileId) {
      const profile = await loadProfile(slug, profileId);
      if (!profile) return c.json({ error: "Context profile not found" }, 404);

      const included = new Set(profile.included_sources);
      const excluded = new Set(profile.excluded_sources);
      const categories = new Set(profile.included_categories);

      sources = sources.filter((s) => {
        if (excluded.has(s.id)) return false;
        if (included.has(s.id)) return true;
        if (categories.size > 0 && s.category && categories.has(s.category)) return true;
        if (included.size === 0 && categories.size === 0) return true;
        return false;
      });
    }

    // Load persisted density metrics; fall back to heuristics for those without
    const metrics: SourceDensityMetrics[] = [];
    const now = new Date().toISOString();

    for (const source of sources) {
      const persisted = await loadDensityMetrics(slug, source.id);
      if (persisted) {
        metrics.push(persisted);
      } else {
        const heuristic = computeHeuristicMetrics(source, sources);
        metrics.push({ ...heuristic, computed_at: now });
      }
    }

    return c.json(metrics);
  }
);

// POST /hub/projects/:projectId/context/density/analyze
contextDensity.post(
  "/hub/projects/:projectId/context/density/analyze",
  async (c) => {
    const slug = c.req.param("projectId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json().catch(() => ({}));
    } catch {
      body = {};
    }

    const parsed = AnalyzeDensityBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400
      );
    }

    const allSources = await loadSources(slug);
    let sourcesToAnalyze = allSources;

    if (parsed.data.source_ids && parsed.data.source_ids.length > 0) {
      const idSet = new Set(parsed.data.source_ids);
      sourcesToAnalyze = allSources.filter((s) => idSet.has(s.id));
    }

    if (sourcesToAnalyze.length === 0) {
      return c.json({ analyzed: 0, metrics: [] });
    }

    // Call Claude Haiku for AI analysis
    const claudeResults = await analyzeWithClaude(sourcesToAnalyze);

    const now = new Date().toISOString();
    const resultMetrics: SourceDensityMetrics[] = [];

    for (const source of sourcesToAnalyze) {
      const heuristic = computeHeuristicMetrics(source, allSources);
      const aiResult = claudeResults.get(source.id);

      // Merge: AI results override heuristics when available
      const metrics: SourceDensityMetrics = {
        ...heuristic,
        computed_at: now,
        information_density:
          aiResult?.information_density ?? heuristic.information_density,
        redundancy_score:
          aiResult?.redundancy_score ?? heuristic.redundancy_score,
        relevance_score:
          aiResult?.relevance_score ?? heuristic.relevance_score,
        recommendations:
          aiResult && aiResult.recommendations.length > 0
            ? aiResult.recommendations
            : heuristic.recommendations,
      };

      await saveDensityMetrics(slug, metrics);
      resultMetrics.push(metrics);
    }

    return c.json({ analyzed: resultMetrics.length, metrics: resultMetrics });
  }
);

export { contextDensity };

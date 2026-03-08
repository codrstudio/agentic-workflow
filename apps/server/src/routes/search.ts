import { Hono } from "hono";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { type Project } from "../schemas/project.js";
import { type SpecDocument } from "../schemas/spec-document.js";
import { type ArchitecturalConstraintRecord } from "../schemas/acr.js";
import { type SecurityFinding } from "../schemas/security.js";
import { type Source } from "../schemas/source.js";
import { type Artifact } from "../schemas/artifact.js";
import { type ChatSession } from "../schemas/session.js";
import { type Review } from "../schemas/review.js";

const search = new Hono();

const VALID_TYPES = [
  "spec",
  "feature",
  "acr",
  "finding",
  "source",
  "artifact",
  "chat_session",
  "review",
] as const;

type SearchResultType = (typeof VALID_TYPES)[number];

interface UnifiedSearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  snippet: string;
  module: string;
  route: string;
  relevance: number;
  updated_at: string;
}

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

/**
 * Compute relevance score (0-1) for a query against title and body text.
 * Priority: exact title > title contains > body exact > body partial
 */
function computeRelevance(q: string, title: string, body: string): number {
  const ql = q.toLowerCase();
  const tl = title.toLowerCase();
  const bl = body.toLowerCase();

  // Exact title match
  if (tl === ql) return 1.0;
  // Title starts with query
  if (tl.startsWith(ql)) return 0.9;
  // Title contains query as whole word
  const wordBoundary = new RegExp(`\\b${escapeRegex(ql)}\\b`, "i");
  if (wordBoundary.test(title)) return 0.85;
  // Title contains query
  if (tl.includes(ql)) return 0.8;
  // Body exact word boundary
  if (wordBoundary.test(body)) return 0.6;
  // Body partial
  if (bl.includes(ql)) return 0.4;

  return 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extract snippet with highlighted match. Returns up to 200 chars with the
 * match wrapped in **...**
 */
function extractSnippet(text: string, q: string): string {
  if (!q || !text) return text.slice(0, 200);
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text.slice(0, 200);

  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + q.length + 80);
  let snippet = text.slice(start, end);

  // Add ellipsis
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  // Highlight match (case-insensitive replacement)
  const matchRe = new RegExp(escapeRegex(q), "gi");
  snippet = snippet.replace(matchRe, (m) => `**${m}**`);

  return snippet;
}

async function loadAllSpecs(slug: string): Promise<SpecDocument[]> {
  const dir = path.join(projectDir(slug), "specs");
  try {
    const entries = await readdir(dir);
    const result: SpecDocument[] = [];
    for (const file of entries.filter((f) => f.endsWith(".json"))) {
      try {
        result.push(await readJSON<SpecDocument>(path.join(dir, file)));
      } catch {
        // skip malformed
      }
    }
    return result;
  } catch {
    return [];
  }
}

async function loadAllACRs(slug: string): Promise<ArchitecturalConstraintRecord[]> {
  const dir = path.join(projectDir(slug), "acrs");
  try {
    const entries = await readdir(dir);
    const result: ArchitecturalConstraintRecord[] = [];
    for (const file of entries.filter((f) => f.endsWith(".json"))) {
      try {
        result.push(await readJSON<ArchitecturalConstraintRecord>(path.join(dir, file)));
      } catch {
        // skip malformed
      }
    }
    return result;
  } catch {
    return [];
  }
}

async function loadAllFindings(slug: string): Promise<SecurityFinding[]> {
  const dir = path.join(projectDir(slug), "security-findings");
  try {
    const entries = await readdir(dir);
    const result: SecurityFinding[] = [];
    for (const file of entries.filter((f) => f.endsWith(".json"))) {
      try {
        result.push(await readJSON<SecurityFinding>(path.join(dir, file)));
      } catch {
        // skip malformed
      }
    }
    return result;
  } catch {
    return [];
  }
}

async function loadAllSources(slug: string): Promise<Source[]> {
  try {
    const raw = await readJSON<Source[]>(
      path.join(projectDir(slug), "sources", "sources.json")
    );
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function loadAllArtifacts(slug: string): Promise<Artifact[]> {
  try {
    const raw = await readJSON<Artifact[]>(
      path.join(projectDir(slug), "artifacts", "artifacts.json")
    );
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function loadAllSessions(slug: string): Promise<ChatSession[]> {
  const dir = path.join(projectDir(slug), "sessions");
  try {
    const entries = await readdir(dir);
    const result: ChatSession[] = [];
    for (const file of entries.filter((f) => f.endsWith(".json"))) {
      try {
        result.push(await readJSON<ChatSession>(path.join(dir, file)));
      } catch {
        // skip malformed
      }
    }
    return result;
  } catch {
    return [];
  }
}

async function loadAllReviews(slug: string): Promise<Review[]> {
  const dir = path.join(projectDir(slug), "reviews");
  try {
    const entries = await readdir(dir);
    const result: Review[] = [];
    for (const file of entries.filter((f) => f.endsWith(".json"))) {
      try {
        result.push(await readJSON<Review>(path.join(dir, file)));
      } catch {
        // skip malformed
      }
    }
    return result;
  } catch {
    return [];
  }
}

type FeatureRecord = {
  id: string;
  name?: string;
  description?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
};

async function loadAllFeatures(slug: string): Promise<FeatureRecord[]> {
  try {
    const raw = await readJSON<FeatureRecord[]>(
      path.join(projectDir(slug), "features.json")
    );
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// GET /hub/projects/:slug/search
search.get("/hub/projects/:slug/search", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const q = (c.req.query("q") ?? "").trim();
  const typesRaw = c.req.query("types");
  const limitParam = c.req.query("limit");

  // Parse types filter
  let typeFilter: Set<SearchResultType> | null = null;
  if (typesRaw) {
    const requested = typesRaw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => VALID_TYPES.includes(t as SearchResultType)) as SearchResultType[];
    if (requested.length > 0) typeFilter = new Set(requested);
  }

  // Parse limit, max 50
  let limit = 20;
  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed > 0) limit = Math.min(parsed, 50);
  }

  // Empty query → return empty
  if (!q) return c.json([]);

  const results: UnifiedSearchResult[] = [];
  const shouldInclude = (t: SearchResultType) => !typeFilter || typeFilter.has(t);

  // Search specs
  if (shouldInclude("spec")) {
    const specs = await loadAllSpecs(slug);
    for (const spec of specs) {
      const body = spec.content_md ?? "";
      const rel = computeRelevance(q, spec.title, body);
      if (rel > 0) {
        const titleOrBody = body.toLowerCase().includes(q.toLowerCase()) ? body : spec.title;
        results.push({
          type: "spec",
          id: spec.id,
          title: spec.title,
          snippet: extractSnippet(titleOrBody, q),
          module: "specs",
          route: `/hub/projects/${slug}/specs/${spec.id}`,
          relevance: rel,
          updated_at: spec.updated_at,
        });
      }
    }
  }

  // Search features
  if (shouldInclude("feature")) {
    const features = await loadAllFeatures(slug);
    for (const f of features) {
      const title = f.name ?? f.id;
      const body = [f.description ?? "", f.id].join(" ");
      const rel = computeRelevance(q, title, body);
      if (rel > 0) {
        const searchBody = (f.description ?? "").toLowerCase().includes(q.toLowerCase())
          ? (f.description ?? "")
          : title;
        results.push({
          type: "feature",
          id: f.id,
          title,
          snippet: extractSnippet(searchBody, q),
          module: "features",
          route: `/hub/projects/${slug}/features/${f.id}`,
          relevance: rel,
          updated_at: f.updated_at ?? f.created_at ?? new Date().toISOString(),
        });
      }
    }
  }

  // Search ACRs
  if (shouldInclude("acr")) {
    const acrs = await loadAllACRs(slug);
    for (const acr of acrs) {
      const body = [acr.constraint, acr.rationale ?? ""].join(" ");
      const rel = computeRelevance(q, acr.title, body);
      if (rel > 0) {
        const searchBody = acr.constraint.toLowerCase().includes(q.toLowerCase())
          ? acr.constraint
          : acr.title;
        results.push({
          type: "acr",
          id: acr.id,
          title: acr.title,
          snippet: extractSnippet(searchBody, q),
          module: "acrs",
          route: `/hub/projects/${slug}/acrs/${acr.id}`,
          relevance: rel,
          updated_at: acr.updated_at,
        });
      }
    }
  }

  // Search findings
  if (shouldInclude("finding")) {
    const findings = await loadAllFindings(slug);
    for (const f of findings) {
      const body = f.description ?? "";
      const rel = computeRelevance(q, f.title, body);
      if (rel > 0) {
        const searchBody = body.toLowerCase().includes(q.toLowerCase()) ? body : f.title;
        results.push({
          type: "finding",
          id: f.id,
          title: f.title,
          snippet: extractSnippet(searchBody, q),
          module: "security",
          route: `/hub/projects/${slug}/security/findings/${f.id}`,
          relevance: rel,
          updated_at: f.created_at,
        });
      }
    }
  }

  // Search sources
  if (shouldInclude("source")) {
    const sources = await loadAllSources(slug);
    for (const s of sources) {
      const body = s.content ?? "";
      const rel = computeRelevance(q, s.name, body);
      if (rel > 0) {
        const searchBody = body.toLowerCase().includes(q.toLowerCase()) ? body : s.name;
        results.push({
          type: "source",
          id: s.id,
          title: s.name,
          snippet: extractSnippet(searchBody, q),
          module: "sources",
          route: `/hub/projects/${slug}/sources/${s.id}`,
          relevance: rel,
          updated_at: s.updated_at,
        });
      }
    }
  }

  // Search artifacts
  if (shouldInclude("artifact")) {
    const artifacts = await loadAllArtifacts(slug);
    for (const a of artifacts) {
      const title = `${a.type}: ${a.name}`;
      const body = a.content ?? "";
      const rel = computeRelevance(q, a.name, [a.type, body].join(" "));
      if (rel > 0) {
        const searchBody = body.toLowerCase().includes(q.toLowerCase()) ? body : title;
        results.push({
          type: "artifact",
          id: a.id,
          title,
          snippet: extractSnippet(searchBody, q),
          module: "artifacts",
          route: `/hub/projects/${slug}/artifacts/${a.id}`,
          relevance: rel,
          updated_at: a.updated_at,
        });
      }
    }
  }

  // Search chat sessions
  if (shouldInclude("chat_session")) {
    const sessions = await loadAllSessions(slug);
    for (const s of sessions) {
      const body = s.messages
        .slice(-5)
        .map((m) => m.content)
        .join(" ");
      const rel = computeRelevance(q, s.title, body);
      if (rel > 0) {
        const searchBody = body.toLowerCase().includes(q.toLowerCase()) ? body : s.title;
        results.push({
          type: "chat_session",
          id: s.id,
          title: s.title,
          snippet: extractSnippet(searchBody, q),
          module: "sessions",
          route: `/hub/projects/${slug}/sessions/${s.id}`,
          relevance: rel,
          updated_at: s.updated_at,
        });
      }
    }
  }

  // Search reviews
  if (shouldInclude("review")) {
    const reviews = await loadAllReviews(slug);
    for (const r of reviews) {
      const body = r.items.map((i) => i.comment ?? "").join(" ");
      const rel = computeRelevance(q, r.title, body);
      if (rel > 0) {
        const searchBody = body.toLowerCase().includes(q.toLowerCase()) ? body : r.title;
        results.push({
          type: "review",
          id: r.id,
          title: r.title,
          snippet: extractSnippet(searchBody, q),
          module: "reviews",
          route: `/hub/projects/${slug}/reviews/${r.id}`,
          relevance: rel,
          updated_at: r.updated_at,
        });
      }
    }
  }

  // Sort by relevance desc, then by recency (updated_at desc)
  results.sort((a, b) => {
    if (b.relevance !== a.relevance) return b.relevance - a.relevance;
    return b.updated_at.localeCompare(a.updated_at);
  });

  return c.json(results.slice(0, limit));
});

export { search };

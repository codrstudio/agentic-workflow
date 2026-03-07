import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import crypto from "node:crypto";
import { readJSON, writeJSON } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ComplianceDecisionLogSchema,
  CreateDecisionLogBody,
  CreateIpReportBody,
  ShadowAiRiskEnum,
  type ComplianceDecisionLog,
  type ComplianceSnapshot,
  type FeatureAttribution,
  type IPAttributionReport,
  type ShadowAiRisk,
} from "../schemas/compliance.js";
import { type ArtifactOrigin } from "../schemas/artifact-origin.js";
import { type DelegationEvent } from "../schemas/delegation-event.js";
import { type Review } from "../schemas/review.js";
import { type Project } from "../schemas/project.js";
import { type FeatureProductivityRecord } from "../schemas/feature-productivity.js";

const compliance = new Hono();

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

// --- Artifact Origins ---

async function loadAllArtifactOrigins(slug: string): Promise<ArtifactOrigin[]> {
  const dir = path.join(projectDir(slug), "artifact-origins");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const results: ArtifactOrigin[] = [];
  for (const file of files) {
    try {
      const record = await readJSON<ArtifactOrigin>(path.join(dir, file));
      results.push(record);
    } catch {
      // skip malformed files
    }
  }
  return results;
}

// --- Delegation Events ---

async function loadAllDelegationEvents(slug: string): Promise<DelegationEvent[]> {
  const dir = path.join(projectDir(slug), "autonomy", "delegation-events");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: DelegationEvent[] = [];
  for (const file of files) {
    try {
      const dayEvents = await readJSON<DelegationEvent[]>(
        path.join(dir, file)
      );
      if (Array.isArray(dayEvents)) all.push(...dayEvents);
    } catch {
      // skip malformed files
    }
  }
  return all;
}

// --- Reviews ---

async function loadAllReviews(slug: string): Promise<Review[]> {
  const dir = path.join(projectDir(slug), "reviews");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const results: Review[] = [];
  for (const file of files) {
    try {
      const review = await readJSON<Review>(path.join(dir, file));
      results.push(review);
    } catch {
      // skip malformed files
    }
  }
  return results;
}

// --- Decision Logs ---

function decisionsDir(slug: string): string {
  return path.join(projectDir(slug), "compliance", "decisions");
}

function decisionsDayPath(slug: string, date: string): string {
  return path.join(decisionsDir(slug), `${date}.json`);
}

async function loadDayDecisions(
  slug: string,
  date: string
): Promise<ComplianceDecisionLog[]> {
  try {
    return await readJSON<ComplianceDecisionLog[]>(
      decisionsDayPath(slug, date)
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayDecisions(
  slug: string,
  date: string,
  logs: ComplianceDecisionLog[]
): Promise<void> {
  await writeJSON(decisionsDayPath(slug, date), logs);
}

async function loadAllDecisions(
  slug: string
): Promise<ComplianceDecisionLog[]> {
  const dir = decisionsDir(slug);
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const all: ComplianceDecisionLog[] = [];
  for (const file of files) {
    const date = file.replace(".json", "");
    const logs = await loadDayDecisions(slug, date);
    all.push(...logs);
  }
  return all;
}

// --- Snapshot Computation ---

function computeCutoff(periodDays: number, now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - periodDays);
  return cutoff;
}

function computeShadowAiRisk(
  unreviewedAiArtifacts: number,
  totalAiArtifacts: number
): ShadowAiRisk {
  if (totalAiArtifacts === 0) return "low";
  const ratio = unreviewedAiArtifacts / totalAiArtifacts;
  if (ratio < 0.1) return "low";
  if (ratio <= 0.3) return "moderate";
  return "high";
}

// POST /hub/projects/:slug/compliance/decisions — register a decision log
compliance.post("/hub/projects/:slug/compliance/decisions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateDecisionLogBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const now = new Date();
  const log: ComplianceDecisionLog = {
    id: crypto.randomUUID(),
    project_id: slug,
    decision_type: parsed.data.decision_type,
    actor: parsed.data.actor,
    target_type: parsed.data.target_type,
    target_id: parsed.data.target_id,
    details: parsed.data.details,
    created_at: now.toISOString(),
  };

  const dateKey = now.toISOString().slice(0, 10);
  const dayLogs = await loadDayDecisions(slug, dateKey);
  dayLogs.push(log);
  await saveDayDecisions(slug, dateKey, dayLogs);

  return c.json(log, 201);
});

// GET /hub/projects/:slug/compliance/decisions — list decision logs with filters
compliance.get("/hub/projects/:slug/compliance/decisions", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const actorFilter = c.req.query("actor");
  const fromFilter = c.req.query("from");
  const limitParam = c.req.query("limit");
  const decisionTypeFilter = c.req.query("decision_type");
  const limit = limitParam ? parseInt(limitParam, 10) : 100;

  let logs = await loadAllDecisions(slug);

  if (actorFilter) {
    logs = logs.filter((l) => l.actor === actorFilter);
  }

  if (decisionTypeFilter) {
    logs = logs.filter((l) => l.decision_type === decisionTypeFilter);
  }

  if (fromFilter) {
    logs = logs.filter((l) => l.created_at >= fromFilter);
  }

  // Sort by created_at descending
  logs.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  logs = logs.slice(0, limit);

  return c.json({ decisions: logs, total: logs.length });
});

// GET /hub/projects/:slug/compliance/snapshot — compute compliance snapshot
compliance.get("/hub/projects/:slug/compliance/snapshot", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const periodDaysParam = c.req.query("period_days");
  const periodDays = periodDaysParam ? parseInt(periodDaysParam, 10) : 30;

  if (isNaN(periodDays) || periodDays < 1) {
    return c.json({ error: "period_days must be a positive integer" }, 400);
  }

  const now = new Date();
  const cutoff = computeCutoff(periodDays, now);
  const cutoffStr = cutoff.toISOString();

  // Load and filter artifact origins by period
  const allOrigins = await loadAllArtifactOrigins(slug);
  const periodOrigins = allOrigins.filter(
    (o) => o.tagged_at >= cutoffStr
  );

  const artifactsByOrigin = {
    ai_generated: 0,
    ai_assisted: 0,
    human_written: 0,
    mixed: 0,
  };
  for (const o of periodOrigins) {
    artifactsByOrigin[o.origin]++;
  }

  const totalArtifacts = periodOrigins.length;
  const totalAiArtifacts =
    artifactsByOrigin.ai_generated + artifactsByOrigin.ai_assisted;
  const ai_ratio =
    totalArtifacts > 0 ? totalAiArtifacts / totalArtifacts : 0;

  // Load and filter delegation events by period
  const allEvents = await loadAllDelegationEvents(slug);
  const periodEvents = allEvents.filter((e) => e.created_at >= cutoffStr);

  // Human oversight events: sign_off_completed, approval_granted, review_requested
  const humanOversightTypes = new Set([
    "sign_off_completed",
    "approval_granted",
    "review_requested",
  ]);
  const humanOversightEvents = periodEvents.filter((e) =>
    humanOversightTypes.has(e.event_type)
  ).length;
  const oversight_ratio =
    totalArtifacts > 0 ? Math.min(1, humanOversightEvents / totalArtifacts) : 0;

  // Load and filter reviews by period
  const allReviews = await loadAllReviews(slug);
  const periodReviews = allReviews.filter(
    (r) => r.created_at >= cutoffStr || r.updated_at >= cutoffStr
  );
  const featuresWithReview = periodReviews.filter(
    (r) => r.status === "approved"
  ).length;
  const featuresWithSignOff = periodReviews.filter(
    (r) => r.status === "approved" && r.criteria.some((c) => c.checked)
  ).length;
  const featuresTotal = periodReviews.length;
  const review_coverage =
    featuresTotal > 0 ? featuresWithReview / featuresTotal : 0;

  // unreviewed AI artifacts: AI artifacts minus those that have an associated approved review
  // Approximation: AI artifacts that exceed the reviewed count
  const unreviewedAiArtifacts = Math.max(
    0,
    totalAiArtifacts - featuresWithReview
  );

  const shadow_ai_risk = computeShadowAiRisk(unreviewedAiArtifacts, totalAiArtifacts);

  // Load decision logs for period
  const allDecisions = await loadAllDecisions(slug);
  const periodDecisions = allDecisions.filter(
    (d) => d.created_at >= cutoffStr
  );

  const snapshot: ComplianceSnapshot = {
    project_id: slug,
    computed_at: now.toISOString(),
    period_days: periodDays,
    total_artifacts: totalArtifacts,
    artifacts_by_origin: artifactsByOrigin,
    ai_ratio,
    total_decisions: periodDecisions.length,
    human_oversight_events: humanOversightEvents,
    oversight_ratio,
    features_total: featuresTotal,
    features_with_review: featuresWithReview,
    features_with_sign_off: featuresWithSignOff,
    review_coverage,
    unreviewed_ai_artifacts: unreviewedAiArtifacts,
    shadow_ai_risk,
  };

  // Persist snapshot
  const snapshotPath = path.join(
    projectDir(slug),
    "compliance",
    "snapshots",
    `${now.toISOString().slice(0, 10)}.json`
  );
  await writeJSON(snapshotPath, snapshot);

  return c.json(snapshot);
});

// --- Feature Productivity Records ---

async function loadAllFeatureProductivityRecords(
  slug: string
): Promise<FeatureProductivityRecord[]> {
  const dir = path.join(projectDir(slug), "productivity", "feature-records");
  let files: string[];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }
  const results: FeatureProductivityRecord[] = [];
  for (const file of files) {
    try {
      const record = await readJSON<FeatureProductivityRecord>(
        path.join(dir, file)
      );
      results.push(record);
    } catch {
      // skip malformed files
    }
  }
  return results;
}

function generateRecommendation(
  protectableRatio: number,
  total: number,
  aiGeneratedCount: number,
  featuresWithHumanReview: number,
  featuresTotal: number
): string {
  if (total === 0) {
    return "No code artifacts found in the specified period. Register feature productivity records to generate an IP attribution report.";
  }
  if (protectableRatio >= 0.8) {
    return `Excellent IP protection posture. ${Math.round(protectableRatio * 100)}% of artifacts have human authorship or meaningful human oversight (ai_assisted, human_written, or mixed). ${featuresWithHumanReview} of ${featuresTotal} features have human review. This codebase has strong grounds for copyright protection.`;
  }
  if (protectableRatio >= 0.5) {
    return `Moderate IP protection. ${Math.round(protectableRatio * 100)}% of artifacts include human authorship or review. ${aiGeneratedCount} artifact(s) are purely AI-generated without documented human oversight. Consider increasing human review coverage before asserting copyright claims. Legal review recommended.`;
  }
  return `Low IP protection ratio (${Math.round(protectableRatio * 100)}%). The majority of artifacts are AI-generated (${aiGeneratedCount} of ${total}). Under current legal frameworks (EU AI Act, US Copyright Office guidance), purely AI-generated content may not qualify for copyright protection. Substantial human authorship or creative oversight should be documented. Legal counsel is strongly advised before any IP claims.`;
}

// POST /hub/projects/:slug/compliance/ip-report — generate IP attribution report on-demand
compliance.post("/hub/projects/:slug/compliance/ip-report", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateIpReportBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { from, to } = parsed.data;
  const fromStr = from.length === 10 ? `${from}T00:00:00.000Z` : from;
  const toStr = to.length === 10 ? `${to}T23:59:59.999Z` : to;

  // Load and filter feature productivity records by period
  const allRecords = await loadAllFeatureProductivityRecords(slug);
  const periodRecords = allRecords.filter((r) => {
    return r.created_at >= fromStr && r.created_at <= toStr;
  });

  // Count by origin
  let ai_generated_count = 0;
  let ai_assisted_count = 0;
  let human_written_count = 0;
  let mixed_count = 0;

  for (const r of periodRecords) {
    if (r.origin === "ai_generated") ai_generated_count++;
    else if (r.origin === "ai_assisted") ai_assisted_count++;
    else if (r.origin === "human_written") human_written_count++;
    else if (r.origin === "mixed") mixed_count++;
  }

  const total_code_artifacts = periodRecords.length;
  const protectable_count = ai_assisted_count + human_written_count + mixed_count;
  const protectable_ratio =
    total_code_artifacts > 0 ? protectable_count / total_code_artifacts : 0;

  // Load delegation events for human oversight actions in the period
  const allEvents = await loadAllDelegationEvents(slug);
  const humanOversightTypes = new Set([
    "sign_off_completed",
    "approval_granted",
    "review_requested",
  ]);
  const human_oversight_actions = allEvents.filter(
    (e) =>
      e.created_at >= fromStr &&
      e.created_at <= toStr &&
      humanOversightTypes.has(e.event_type)
  ).length;

  // Load reviews for human review/edit info
  const allReviews = await loadAllReviews(slug);
  const periodReviews = allReviews.filter(
    (r) =>
      (r.created_at >= fromStr && r.created_at <= toStr) ||
      (r.updated_at >= fromStr && r.updated_at <= toStr)
  );
  const features_with_human_review = periodReviews.filter(
    (r) => r.status === "approved"
  ).length;
  // A feature has human edit if its review has flagged items (indicating reviewer edited/flagged something)
  const features_with_human_edit = periodReviews.filter(
    (r) => r.items.some((item) => item.status === "flagged" || item.comment)
  ).length;

  // Build feature_attributions from productivity records
  const feature_attributions: FeatureAttribution[] = periodRecords.map((r) => {
    return {
      feature_id: r.feature_id,
      origin: r.origin,
      human_oversight_count: r.review_rounds,
      has_human_edit: r.rework_count > 0,
      ai_models_used: [],
    };
  });

  const recommendation = generateRecommendation(
    protectable_ratio,
    total_code_artifacts,
    ai_generated_count,
    features_with_human_review,
    periodRecords.length
  );

  const now = new Date();
  const report: IPAttributionReport = {
    project_id: slug,
    generated_at: now.toISOString(),
    period: { from, to },
    total_code_artifacts,
    ai_generated_count,
    ai_assisted_count,
    human_written_count,
    mixed_count,
    human_oversight_actions,
    features_with_human_review,
    features_with_human_edit,
    feature_attributions,
    protectable_ratio,
    recommendation,
  };

  // Persist report
  const reportPath = path.join(
    projectDir(slug),
    "compliance",
    "ip-reports",
    `${now.toISOString().slice(0, 10)}.json`
  );
  await writeJSON(reportPath, report);

  return c.json(report, 201);
});

export { compliance };

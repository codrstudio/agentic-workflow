import { Hono } from "hono";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ComprehensionGateSchema,
  CreateGateBodySchema,
  PatchGateBodySchema,
  IndicatorsCacheSchema,
  DetectRiskBodySchema,
  type ComprehensionGate,
  type IndicatorsCache,
  type CognitiveDebtIndicator,
  type AutoDetectedRisk,
  type ComprehensionGateType,
} from "../schemas/cognitive-debt.js";
import { type Project } from "../schemas/project.js";
import { spawnClaudeStream } from "../lib/claude-client.js";

const INDICATORS_TTL_MINUTES = 10;

const cognitiveDebt = new Hono();

// ---- helpers ----

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
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

function gatesDir(slug: string): string {
  return path.join(projectDir(slug), "cognitive-debt", "gates");
}

function gateDayPath(slug: string, date: string): string {
  return path.join(gatesDir(slug), `${date}.json`);
}

function indicatorsCachePath(slug: string): string {
  return path.join(projectDir(slug), "cognitive-debt", "indicators-cache.json");
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadDayGates(
  slug: string,
  date: string,
): Promise<ComprehensionGate[]> {
  try {
    return await readJSON<ComprehensionGate[]>(gateDayPath(slug, date));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function saveDayGates(
  slug: string,
  date: string,
  gates: ComprehensionGate[],
): Promise<void> {
  await ensureDir(gatesDir(slug));
  await writeJSON(gateDayPath(slug, date), gates);
}

/** Load all gates across all day files in the given date range (inclusive). */
async function loadGatesInRange(
  slug: string,
  from: string,
  to: string,
): Promise<ComprehensionGate[]> {
  let files: string[] = [];
  try {
    const entries = await readdir(gatesDir(slug));
    files = entries
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .filter((date) => date >= from && date <= to)
      .sort();
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const all: ComprehensionGate[] = [];
  for (const date of files) {
    const dayGates = await loadDayGates(slug, date);
    all.push(...dayGates);
  }
  return all;
}

/** Compute CognitiveDebtIndicator from gates. */
function computeIndicators(
  projectId: string,
  gates: ComprehensionGate[],
  from: string,
  to: string,
): CognitiveDebtIndicator {
  const total = gates.length;
  const completed = gates.filter((g) => g.completed).length;
  const bypassed = gates.filter((g) => g.bypassed).length;

  const completionRate = total > 0 ? completed / total : 0;

  const withLoad = gates.filter(
    (g) => g.cognitive_load_score !== null && g.cognitive_load_score !== undefined,
  );
  const avgLoad =
    withLoad.length > 0
      ? withLoad.reduce((sum, g) => sum + (g.cognitive_load_score ?? 0), 0) /
        withLoad.length
      : null;

  // high_risk_phases: phases that have at least one high-risk gate
  const highRiskPhases = [
    ...new Set(
      gates
        .filter((g) => g.auto_detected_risk === "high")
        .map((g) => g.phase),
    ),
  ];

  // generation_rate and review_rate are not tracked in gate data;
  // use heuristic placeholders (0) — real values come from future tracking features
  const generationRate = 0;
  const reviewRate = 0;

  // comprehension_gap_ratio: ratio of bypassed to completed (or total if 0 completed)
  // A higher ratio = more bypasses relative to completions = more debt
  const comprehensionGapRatio =
    completed > 0 ? bypassed / completed : bypassed > 0 ? Infinity : 0;

  return {
    project_id: projectId,
    computed_at: new Date().toISOString(),
    period: { from, to },
    total_gates: total,
    completed_gates: completed,
    bypassed_gates: bypassed,
    completion_rate: completionRate,
    avg_cognitive_load: avgLoad,
    high_risk_phases: highRiskPhases,
    generation_rate_lines_per_min: generationRate,
    review_rate_lines_per_min: reviewRate,
    comprehension_gap_ratio:
      comprehensionGapRatio === Infinity ? 99 : comprehensionGapRatio,
  };
}

function isCacheValid(cache: IndicatorsCache): boolean {
  const cachedAt = new Date(cache.cached_at).getTime();
  const ttlMs = cache.ttl_minutes * 60 * 1000;
  return Date.now() - cachedAt < ttlMs;
}

// ---- routes ----

// GET /hub/projects/:projectId/cognitive-debt/gates
cognitiveDebt.get(
  "/hub/projects/:projectId/cognitive-debt/gates",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const phaseFilter = c.req.query("phase");
    const completedFilter = c.req.query("completed");

    // Load all day files
    let files: string[] = [];
    try {
      const entries = await readdir(gatesDir(slug));
      files = entries
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
        .sort();
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return c.json([]);
      throw err;
    }

    const all: ComprehensionGate[] = [];
    for (const date of files) {
      const dayGates = await loadDayGates(slug, date);
      all.push(...dayGates);
    }

    let result = all;

    if (phaseFilter !== undefined) {
      result = result.filter((g) => g.phase === phaseFilter);
    }

    if (completedFilter !== undefined) {
      const wantCompleted = completedFilter === "true";
      result = result.filter((g) => g.completed === wantCompleted);
    }

    return c.json(result);
  },
);

// POST /hub/projects/:projectId/cognitive-debt/gates
cognitiveDebt.post(
  "/hub/projects/:projectId/cognitive-debt/gates",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = CreateGateBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
    }

    const now = new Date().toISOString();
    const date = todayDate();

    const gate: ComprehensionGate = {
      id: randomUUID(),
      project_id: project.id,
      session_id: parsed.data.session_id ?? null,
      phase: parsed.data.phase,
      type: parsed.data.type,
      prompt: parsed.data.prompt,
      response: null,
      cognitive_load_score: null,
      auto_detected_risk: parsed.data.auto_detected_risk ?? "low",
      completed: false,
      bypassed: false,
      created_at: now,
      completed_at: null,
    };

    // Validate with full schema
    const validated = ComprehensionGateSchema.parse(gate);

    const dayGates = await loadDayGates(slug, date);
    dayGates.push(validated);
    await saveDayGates(slug, date, dayGates);

    return c.json(validated, 201);
  },
);

// PATCH /hub/projects/:projectId/cognitive-debt/gates/:gateId
cognitiveDebt.patch(
  "/hub/projects/:projectId/cognitive-debt/gates/:gateId",
  async (c) => {
    const slug = c.req.param("projectId");
    const gateId = c.req.param("gateId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchGateBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
    }

    // Search across all day files for the gate
    let files: string[] = [];
    try {
      const entries = await readdir(gatesDir(slug));
      files = entries
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""))
        .sort();
    } catch (err) {
      const e = err as NodeJS.ErrnoException;
      if (e.code === "ENOENT") return c.json({ error: "Gate not found" }, 404);
      throw err;
    }

    for (const date of files) {
      const dayGates = await loadDayGates(slug, date);
      const idx = dayGates.findIndex((g) => g.id === gateId);
      if (idx === -1) continue;

      const existing = dayGates[idx]!;
      const updated: ComprehensionGate = {
        ...existing,
        ...parsed.data,
      };

      // Auto-set completed_at if completing without an explicit timestamp
      if (parsed.data.completed === true && !updated.completed_at) {
        updated.completed_at = new Date().toISOString();
      }

      dayGates[idx] = updated;
      await saveDayGates(slug, date, dayGates);

      // Invalidate indicators cache
      try {
        await writeJSON(indicatorsCachePath(slug), null);
      } catch {
        // ignore cache invalidation errors
      }

      return c.json(updated);
    }

    return c.json({ error: "Gate not found" }, 404);
  },
);

// GET /hub/projects/:projectId/cognitive-debt/indicators
cognitiveDebt.get(
  "/hub/projects/:projectId/cognitive-debt/indicators",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const today = todayDate();
    const from = c.req.query("from") ?? today;
    const to = c.req.query("to") ?? today;

    // Check cache (only when no explicit date range or default range)
    const useCache = !c.req.query("from") && !c.req.query("to");
    if (useCache) {
      try {
        const cache = await readJSON<IndicatorsCache>(indicatorsCachePath(slug));
        if (cache && isCacheValid(cache)) {
          return c.json(cache.data);
        }
      } catch {
        // no cache or invalid — compute fresh
      }
    }

    const gates = await loadGatesInRange(slug, from, to);
    const indicators = computeIndicators(project.id, gates, from, to);

    // Store cache only for default (today) range
    if (useCache) {
      const cacheEntry: IndicatorsCache = {
        cached_at: new Date().toISOString(),
        ttl_minutes: INDICATORS_TTL_MINUTES,
        data: indicators,
      };
      try {
        await writeJSON(indicatorsCachePath(slug), cacheEntry);
      } catch {
        // ignore cache write errors
      }
    }

    return c.json(indicators);
  },
);

// ---- detect-risk helpers ----

function computeRiskLevel(
  linesGenerated: number,
  artifactsChanged: number,
): AutoDetectedRisk {
  if (linesGenerated > 500 || artifactsChanged > 100) return "high";
  if (linesGenerated > 200 || artifactsChanged > 50) return "medium";
  return "low";
}

function gateTypeForRisk(risk: AutoDetectedRisk): ComprehensionGateType {
  if (risk === "high") return "diff_review";
  if (risk === "medium") return "summary_required";
  return "intent_confirmation";
}

const FALLBACK_PROMPTS: Record<AutoDetectedRisk, (phase: string) => string> = {
  high: (phase) =>
    `You just generated a large amount of code in the "${phase}" phase. ` +
    `Please review the diff and summarize: what was added, what changed, and what could break?`,
  medium: (phase) =>
    `You made significant changes in the "${phase}" phase. ` +
    `In 2-3 sentences, summarize what you implemented and why.`,
  low: (phase) =>
    `Quick check for the "${phase}" phase: what was your main intent with these changes?`,
};

function spawnClaudePromise(
  userPrompt: string,
  model: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let result = "";
    const proc = spawnClaudeStream(
      { prompt: userPrompt, model, maxTurns: 1, allowedTools: [] },
      {
        onDelta: (text) => {
          result += text;
        },
        onComplete: (full) => {
          resolve(full || result);
        },
        onError: (err) => {
          reject(new Error(err));
        },
      },
    );
    // Safety timeout: if process hangs, reject after 30s
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error("Claude Haiku timeout"));
    }, 30_000);
    proc.on("exit", () => clearTimeout(timer));
  });
}

// POST /hub/projects/:projectId/cognitive-debt/detect-risk
cognitiveDebt.post(
  "/hub/projects/:projectId/cognitive-debt/detect-risk",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = DetectRiskBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.issues }, 400);
    }

    const { phase, artifacts_changed, lines_generated } = parsed.data;

    const riskLevel = computeRiskLevel(lines_generated, artifacts_changed);
    const gateType = gateTypeForRisk(riskLevel);

    const riskLabel =
      riskLevel === "high" ? "HIGH" : riskLevel === "medium" ? "MEDIUM" : "LOW";

    const haikusPrompt =
      `You are a cognitive load assistant for software developers. ` +
      `A developer just completed the "${phase}" phase of an agentic pipeline. ` +
      `They generated ${lines_generated} lines of code and changed ${artifacts_changed} artifacts. ` +
      `Risk level: ${riskLabel}. ` +
      `Generate ONE concise comprehension-check question (1-2 sentences) that tests whether ` +
      `the developer truly understands what was built. ` +
      `The question should be specific to the phase "${phase}" and proportional to the volume of changes. ` +
      `Reply with ONLY the question text, no preamble.`;

    let prompt: string;
    try {
      const raw = await spawnClaudePromise(haikusPrompt, "claude-haiku-4-5-20251001");
      prompt = raw.trim() || FALLBACK_PROMPTS[riskLevel](phase);
    } catch {
      // Fallback when Claude Haiku is unavailable
      prompt = FALLBACK_PROMPTS[riskLevel](phase);
    }

    return c.json({ risk_level: riskLevel, gate_type: gateType, prompt });
  },
);

export { cognitiveDebt };

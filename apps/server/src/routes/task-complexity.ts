import { Hono } from "hono";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { spawnClaudeStream } from "../lib/claude-client.js";
import {
  ClassifyTaskBody,
  type TaskComplexity,
  type TaskComplexityLevel,
  type ClassifyTaskBody as ClassifyTaskBodyType,
} from "../schemas/task-complexity.js";
import { type Project } from "../schemas/project.js";

const taskComplexity = new Hono();

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

function classificationsDir(slug: string): string {
  return path.join(
    projectDir(slug),
    "task-complexity",
    "classifications"
  );
}

// --- Heuristic classification engine ---

const KEYWORDS_TRIVIAL = [
  "fix typo",
  "rename",
  "config",
  "env",
  "version bump",
  "update dep",
  "update dependency",
  "typo",
  "bump",
];

const KEYWORDS_SMALL = [
  "fix bug",
  "patch",
  "adjust",
  "tweak",
  "small",
  "bugfix",
  "hotfix",
];

const KEYWORDS_MEDIUM = [
  "add feature",
  "implement",
  "create",
  "new component",
  "refactor",
  "feature",
];

const KEYWORDS_LARGE = [
  "redesign",
  "architecture",
  "migration",
  "new module",
  "integration",
  "overhaul",
  "rewrite",
];

const DB_KEYWORDS = ["database", "schema", "migration", "table", "model"];
const API_KEYWORDS = ["endpoint", "api", "route", "rest"];
const UI_KEYWORDS = ["component", "page", "screen", "ui", "layout"];

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

const LEVEL_TO_TEMPLATE = {
  trivial: "checklist",
  small: "spec_resumida",
  medium: "spec_completa",
  large: "prp_completo",
} as const;

const LEVEL_ORDER: TaskComplexityLevel[] = [
  "trivial",
  "small",
  "medium",
  "large",
];

function classifyHeuristic(
  title: string,
  description: string
): {
  level: TaskComplexityLevel;
  signals: TaskComplexity["signals"];
} {
  const text = `${title} ${description}`;

  const trivialScore = countMatches(text, KEYWORDS_TRIVIAL);
  const smallScore = countMatches(text, KEYWORDS_SMALL);
  const mediumScore = countMatches(text, KEYWORDS_MEDIUM);
  const largeScore = countMatches(text, KEYWORDS_LARGE);

  const hasDb = containsAny(text, DB_KEYWORDS);
  const hasApi = containsAny(text, API_KEYWORDS);
  const hasUi = containsAny(text, UI_KEYWORDS);
  const crossCuttingCount = [hasDb, hasApi, hasUi].filter(Boolean).length;
  const crossCutting = crossCuttingCount >= 2;

  // Determine level from keyword scores
  const scores = [
    { level: "trivial" as const, score: trivialScore },
    { level: "small" as const, score: smallScore },
    { level: "medium" as const, score: mediumScore },
    { level: "large" as const, score: largeScore },
  ];

  // Pick highest scoring level, default to small if no matches
  const bestMatch = scores.reduce((best, cur) =>
    cur.score > best.score ? cur : best
  );
  let level: TaskComplexityLevel =
    bestMatch.score > 0 ? bestMatch.level : "small";

  // Apply cross-cutting minimum
  let minLevel: TaskComplexityLevel = "trivial";
  if (crossCutting) minLevel = "medium";
  if (hasDb && hasApi && hasUi) minLevel = "large";

  // Enforce minimum
  const levelIdx = LEVEL_ORDER.indexOf(level);
  const minIdx = LEVEL_ORDER.indexOf(minLevel);
  if (minIdx > levelIdx) {
    level = minLevel;
  }

  return {
    level,
    signals: {
      has_db_changes: hasDb,
      has_api_changes: hasApi,
      has_ui_changes: hasUi,
      cross_cutting: crossCutting,
    },
  };
}

// --- AI classification via Claude CLI ---

function classifyWithAI(
  title: string,
  description: string
): Promise<{ level: TaskComplexityLevel; confidence: number }> {
  return new Promise((resolve, reject) => {
    const prompt = `Classifique a complexidade desta tarefa de desenvolvimento:
Titulo: ${title}
Descricao: ${description}

Niveis: trivial (config/typo), small (bug fix), medium (feature), large (modulo/integracao)
Responda APENAS com JSON valido, sem markdown: { "level": "...", "confidence": 0.0-1.0, "reasoning": "..." }`;

    let fullText = "";

    spawnClaudeStream(
      {
        prompt,
        maxTurns: 1,
        allowedTools: [],
      },
      {
        onDelta: (text) => {
          fullText += text;
        },
        onComplete: () => {
          try {
            // Extract JSON from response (may have extra text around it)
            const jsonMatch = fullText.match(/\{[^}]*"level"\s*:\s*"[^"]+?"[^}]*\}/);
            if (!jsonMatch) {
              // Fallback to heuristic
              resolve({ level: "small", confidence: 0.3 });
              return;
            }
            const parsed = JSON.parse(jsonMatch[0]);
            const validLevels = ["trivial", "small", "medium", "large"];
            const level = validLevels.includes(parsed.level)
              ? (parsed.level as TaskComplexityLevel)
              : "small";
            const confidence =
              typeof parsed.confidence === "number"
                ? Math.max(0, Math.min(1, parsed.confidence))
                : 0.5;
            resolve({ level, confidence });
          } catch {
            resolve({ level: "small", confidence: 0.3 });
          }
        },
        onError: (error) => {
          reject(new Error(`AI classification failed: ${error}`));
        },
      }
    );
  });
}

// --- Routes ---

// POST /hub/projects/:slug/tasks/classify
taskComplexity.post("/hub/projects/:slug/tasks/classify", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = ClassifyTaskBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { title, description, method, complexity_level } = parsed.data;

  let level: TaskComplexityLevel;
  let confidence: number | undefined;
  let signals: TaskComplexity["signals"];

  if (method === "manual") {
    if (!complexity_level) {
      return c.json(
        { error: "complexity_level is required for manual classification" },
        400
      );
    }
    level = complexity_level;
    signals = undefined;
  } else if (method === "auto_heuristic") {
    const result = classifyHeuristic(title, description);
    level = result.level;
    signals = result.signals;
  } else {
    // auto_ai
    try {
      const result = await classifyWithAI(title, description);
      level = result.level;
      confidence = result.confidence;
      signals = undefined;
    } catch {
      // Fallback to heuristic if AI fails
      const result = classifyHeuristic(title, description);
      level = result.level;
      signals = result.signals;
      confidence = undefined;
    }
  }

  const classification: TaskComplexity = {
    id: randomUUID(),
    project_id: project.id,
    title,
    description,
    complexity_level: level,
    classification_method: method,
    confidence,
    signals,
    spec_template: LEVEL_TO_TEMPLATE[level],
    created_at: new Date().toISOString(),
  };

  // Persist
  const dir = classificationsDir(slug);
  await ensureDir(dir);
  await writeJSON(path.join(dir, `${classification.id}.json`), classification);

  return c.json(classification, 201);
});

// GET /hub/projects/:slug/tasks/classifications
taskComplexity.get(
  "/hub/projects/:slug/tasks/classifications",
  async (c) => {
    const slug = c.req.param("slug");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 20;

    const dir = classificationsDir(slug);

    let files: string[];
    try {
      files = await readdir(dir);
    } catch {
      return c.json([], 200);
    }

    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    // Load all classifications
    const classifications: TaskComplexity[] = [];
    for (const file of jsonFiles) {
      try {
        const item = await readJSON<TaskComplexity>(path.join(dir, file));
        classifications.push(item);
      } catch {
        // Skip corrupt files
      }
    }

    // Sort by created_at descending (most recent first)
    classifications.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    // Apply limit
    const result = classifications.slice(0, limit);

    return c.json(result, 200);
  }
);

export { taskComplexity };

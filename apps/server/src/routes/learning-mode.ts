import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  LearningModeConfigSchema,
  MODE_DEFAULTS,
  PutLearningModeBody,
  ReflectionCheckpointSchema,
  CreateReflectionBody,
  PatchReflectionBody,
  GenerateReflectionBody,
  EvaluateReflectionBody,
  CheckpointTypeEnum,
  DepthClassificationEnum,
  type LearningModeConfig,
  type ReflectionCheckpoint,
} from "../schemas/learning-mode.js";
import { type Project } from "../schemas/project.js";

const learningMode = new Hono();

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

function learningModeConfigPath(slug: string): string {
  return path.join(projectDir(slug), "learning-mode-config.json");
}

function reflectionsDirPath(slug: string): string {
  return path.join(projectDir(slug), "reflections");
}

function reflectionPath(slug: string, id: string): string {
  return path.join(reflectionsDirPath(slug), `${id}.json`);
}

async function loadLearningModeConfig(
  slug: string,
  projectId: string
): Promise<LearningModeConfig> {
  try {
    return await readJSON<LearningModeConfig>(learningModeConfigPath(slug));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) {
      // Return default config
      return {
        project_id: projectId,
        mode: "standard",
        phase_transitions: MODE_DEFAULTS.standard,
        updated_at: new Date().toISOString(),
      };
    }
    throw err;
  }
}

// GET /hub/projects/:slug/learning-mode
learningMode.get("/hub/projects/:slug/learning-mode", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const cfg = await loadLearningModeConfig(slug, project.id);
  return c.json(cfg);
});

// PUT /hub/projects/:slug/learning-mode
learningMode.put("/hub/projects/:slug/learning-mode", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PutLearningModeBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const { mode, phase_transitions } = parsed.data;

  // If phase_transitions not provided, use mode defaults
  const transitions = phase_transitions ?? MODE_DEFAULTS[mode];

  const cfg: LearningModeConfig = {
    project_id: project.id,
    mode,
    phase_transitions: transitions,
    updated_at: new Date().toISOString(),
  };

  await writeJSON(learningModeConfigPath(slug), cfg);
  return c.json(cfg);
});

// GET /hub/projects/:slug/reflections
learningMode.get("/hub/projects/:slug/reflections", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const dir = reflectionsDirPath(slug);

  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      return c.json([]);
    }
    throw err;
  }

  const reflections: ReflectionCheckpoint[] = [];
  for (const file of files) {
    try {
      const r = await readJSON<ReflectionCheckpoint>(path.join(dir, file));
      reflections.push(r);
    } catch {
      // skip malformed files
    }
  }

  // Apply query filters
  const phaseTransition = c.req.query("phase_transition");
  const depth = c.req.query("depth");
  const skipped = c.req.query("skipped");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);

  let filtered = reflections;

  if (phaseTransition) {
    filtered = filtered.filter((r) => r.phase_transition === phaseTransition);
  }

  if (depth) {
    filtered = filtered.filter((r) => r.depth_classification === depth);
  }

  if (skipped !== undefined) {
    const skippedBool = skipped === "true";
    filtered = filtered.filter((r) => r.skipped === skippedBool);
  }

  filtered = filtered.slice(0, isNaN(limit) ? 50 : limit);

  return c.json(filtered);
});

// POST /hub/projects/:slug/reflections
learningMode.post("/hub/projects/:slug/reflections", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateReflectionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  const reflection: ReflectionCheckpoint = {
    id,
    project_id: project.id,
    phase_transition: parsed.data.phase_transition,
    checkpoint_type: parsed.data.checkpoint_type,
    questions: parsed.data.questions,
    developer_response: parsed.data.developer_response ?? null,
    ai_evaluation: parsed.data.ai_evaluation ?? null,
    depth_classification: parsed.data.depth_classification ?? null,
    skipped: parsed.data.skipped ?? false,
    created_at: now,
    completed_at: parsed.data.completed_at ?? null,
  };

  await ensureDir(reflectionsDirPath(slug));
  await writeJSON(reflectionPath(slug, id), reflection);

  return c.json(reflection, 201);
});

// --- AI helpers (deterministic simulation) ---

type CheckpointType = z.infer<typeof CheckpointTypeEnum>;
type DepthClassification = z.infer<typeof DepthClassificationEnum>;

const PHASE_CHECKPOINT_MAP: Record<string, CheckpointType> = {
  "brainstorming→specs": "comprehension_check",
  "specs→prps": "design_rationale",
  "prps→implementation": "tradeoff_analysis",
  "implementation→review": "review_summary",
  "review→merge": "comprehension_check",
};

const PHASE_QUESTIONS: Record<string, string[]> = {
  "brainstorming→specs": [
    "What are the top 3 user problems this spec should solve, and how did the brainstorming sessions reveal them?",
    "Which discoveries from the brainstorming phase had the highest pain/gain scores, and how are they reflected in the spec?",
    "What constraints or risks were identified that should be documented in the spec before proceeding?",
  ],
  "specs→prps": [
    "How does the proposed API design in the PRP address the core requirements defined in the spec?",
    "What design decisions were made when translating the spec into the PRP, and what tradeoffs did you consider?",
    "Are there any spec requirements that are not fully covered by the PRP? If so, why?",
  ],
  "prps→implementation": [
    "What are the biggest technical risks in implementing this PRP, and how do you plan to mitigate them?",
    "Which implementation approach did you choose between the alternatives, and what led to that decision?",
    "What external dependencies or integrations could block the implementation, and what is your contingency plan?",
  ],
  "implementation→review": [
    "Does the implementation fully satisfy the acceptance criteria defined in the spec? List any gaps.",
    "What refactoring or cleanup was done during implementation that deviated from the original PRP plan?",
    "What test coverage was added, and are there any edge cases that remain untested?",
  ],
  "review→merge": [
    "What review feedback was addressed, and were any suggestions deferred for a later sprint?",
    "Does the implementation introduce any new technical debt, and has it been documented?",
    "Is the code ready for long-term maintenance by another developer? What documentation is missing?",
  ],
};

function getQuestionsForPhase(
  phaseTransition: string,
  context?: { sprint?: string; features_in_progress?: string[]; recent_decisions?: string[] }
): { questions: string[]; checkpoint_type: CheckpointType } {
  const checkpoint_type: CheckpointType = PHASE_CHECKPOINT_MAP[phaseTransition] ?? "comprehension_check";
  const baseQuestions = PHASE_QUESTIONS[phaseTransition] ?? PHASE_QUESTIONS["implementation→review"]!;

  // Select 2-3 questions, adding context-aware variation when context is provided
  let questions: string[];
  if (context?.features_in_progress?.length) {
    const featureList = context.features_in_progress.slice(0, 2).join(", ");
    questions = [
      baseQuestions[0]!,
      `For features ${featureList}: what decisions were made that future maintainers should understand?`,
      baseQuestions[2] ?? baseQuestions[1]!,
    ];
  } else {
    questions = baseQuestions.slice(0, 3);
  }

  return { questions: questions.slice(0, 3), checkpoint_type };
}

function classifyDepth(response: string): DepthClassification {
  const trimmed = response.trim();
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

  if (wordCount < 15) return "shallow";
  if (wordCount < 60) return "adequate";
  return "deep";
}

function generateEvaluation(response: string, depth: DepthClassification): string {
  const evaluations: Record<DepthClassification, string[]> = {
    shallow: [
      "The response is brief and lacks specific technical detail. Consider elaborating on the reasoning behind decisions and any tradeoffs encountered.",
      "While the response acknowledges the topic, it does not demonstrate deep engagement with the underlying concerns. Adding concrete examples would strengthen it.",
    ],
    adequate: [
      "The response shows reasonable understanding and covers the key points. To reach a deeper level, consider addressing edge cases or alternative approaches considered.",
      "Good awareness of the issues involved. The analysis could be strengthened by connecting specific implementation details to broader architectural decisions.",
    ],
    deep: [
      "Excellent response demonstrating thorough understanding. The analysis covers tradeoffs, alternatives, and specific technical implications — exactly the depth needed to preserve institutional knowledge.",
      "Strong reflection that shows genuine engagement with the complexity of the problem. This level of analysis will be valuable for future developers working on this codebase.",
    ],
  };

  const options = evaluations[depth];
  // Deterministic selection based on response length to avoid randomness
  const idx = response.length % options.length;
  return options[idx]!;
}

// POST /hub/projects/:slug/reflections/generate
learningMode.post("/hub/projects/:slug/reflections/generate", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = GenerateReflectionBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const { phase_transition, context } = parsed.data;
  const { questions, checkpoint_type } = getQuestionsForPhase(phase_transition, context);

  return c.json({ questions, checkpoint_type });
});

// POST /hub/projects/:slug/reflections/:reflectionId/evaluate
learningMode.post(
  "/hub/projects/:slug/reflections/:reflectionId/evaluate",
  async (c) => {
    const slug = c.req.param("slug");
    const reflectionId = c.req.param("reflectionId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let existing: ReflectionCheckpoint;
    try {
      existing = await readJSON<ReflectionCheckpoint>(reflectionPath(slug, reflectionId));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        return c.json({ error: "Reflection not found" }, 404);
      }
      throw err;
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = EvaluateReflectionBody.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
    }

    const { developer_response } = parsed.data;
    const depth_classification = classifyDepth(developer_response);
    const ai_evaluation = generateEvaluation(developer_response, depth_classification);
    const completed_at = new Date().toISOString();

    const updated: ReflectionCheckpoint = {
      ...existing,
      developer_response,
      ai_evaluation,
      depth_classification,
      completed_at,
    };

    await writeJSON(reflectionPath(slug, reflectionId), updated);

    return c.json({ ai_evaluation, depth_classification });
  }
);

// PATCH /hub/projects/:slug/reflections/:reflectionId
learningMode.patch(
  "/hub/projects/:slug/reflections/:reflectionId",
  async (c) => {
    const slug = c.req.param("slug");
    const reflectionId = c.req.param("reflectionId");

    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    let existing: ReflectionCheckpoint;
    try {
      existing = await readJSON<ReflectionCheckpoint>(
        reflectionPath(slug, reflectionId)
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not found")) {
        return c.json({ error: "Reflection not found" }, 404);
      }
      throw err;
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    const parsed = PatchReflectionBody.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid body", details: parsed.error.issues },
        400
      );
    }

    const updated: ReflectionCheckpoint = {
      ...existing,
      ...Object.fromEntries(
        Object.entries(parsed.data).filter(([, v]) => v !== undefined)
      ),
    };

    await writeJSON(reflectionPath(slug, reflectionId), updated);
    return c.json(updated);
  }
);

export { learningMode };

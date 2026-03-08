import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  LearningCheckpointSchema,
  GenerateCheckpointBody,
  SubmitCheckpointBody,
  type LearningCheckpoint,
} from "../schemas/learning-checkpoint.js";
import {
  MentoringProfileSchema,
  type MentoringProfile,
  type ExperienceLevel,
} from "../schemas/mentoring-profile.js";
import { type Project } from "../schemas/project.js";

const learningCheckpoints = new Hono();

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

async function loadProfile(slug: string, profileId: string): Promise<MentoringProfile | null> {
  try {
    const p = await readJSON<unknown>(
      path.join(projectDir(slug), "mentoring-profiles", `${profileId}.json`)
    );
    const parsed = MentoringProfileSchema.safeParse(p);
    return parsed.success ? parsed.data : null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) return null;
    throw err;
  }
}

function checkpointsDir(slug: string): string {
  return path.join(projectDir(slug), "learning-checkpoints");
}

function checkpointPath(slug: string, id: string): string {
  return path.join(checkpointsDir(slug), `${id}.json`);
}

async function loadAllCheckpoints(slug: string): Promise<LearningCheckpoint[]> {
  const dir = checkpointsDir(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json")).sort();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("ENOENT") || msg.includes("not found")) return [];
    throw err;
  }

  const checkpoints: LearningCheckpoint[] = [];
  for (const file of files) {
    try {
      const c = await readJSON<LearningCheckpoint>(path.join(dir, file));
      checkpoints.push(c);
    } catch {
      // skip malformed
    }
  }
  return checkpoints;
}

// --- Content generation (deterministic, adapted per experience_level) ---

type PhaseContent = {
  beginner: { objectives: string[]; questions: string[]; explanation: string; key_decisions: string[] };
  junior: { objectives: string[]; questions: string[]; explanation: string; key_decisions: string[] };
  mid: { objectives: string[]; questions: string[]; explanation: string; key_decisions: string[] };
  senior: { objectives: string[]; questions: string[]; explanation: string; key_decisions: string[] };
};

const PHASE_CONTENT: Record<string, PhaseContent> = {
  brainstorming: {
    beginner: {
      objectives: [
        "Understand what brainstorming means in software projects",
        "Learn how to list problems before solving them",
        "Identify at least one pain point in the current project",
      ],
      questions: [
        "What is the main problem this project is trying to solve?",
        "Can you name one thing that users find frustrating about similar tools?",
      ],
      explanation:
        "Brainstorming is the first phase where the team explores problems and opportunities without filtering ideas. It is about quantity over quality at this stage.",
      key_decisions: ["Problem scope", "Target users"],
    },
    junior: {
      objectives: [
        "Identify key pain points and gain opportunities",
        "Prioritize discoveries by impact and feasibility",
        "Map problems to potential solutions",
        "Document assumptions for validation",
      ],
      questions: [
        "Which pain point has the highest impact on users and why?",
        "What assumptions are you making about user behavior that need validation?",
        "How did you prioritize the discoveries in this phase?",
      ],
      explanation:
        "Brainstorming produces a ranked set of pain/gain pairs. Junior developers should practice articulating trade-offs between impact and effort.",
      key_decisions: ["Priority ranking criteria", "Assumptions list", "Scope boundaries"],
    },
    mid: {
      objectives: [
        "Evaluate pain/gain pairs using quantitative criteria",
        "Identify systemic patterns across discoveries",
        "Define MVP scope from brainstorming outputs",
        "Map dependencies between problem areas",
        "Assess technical feasibility of top opportunities",
      ],
      questions: [
        "What systemic pattern connects the top-ranked pain points?",
        "How would you define the MVP scope given the brainstorming results?",
        "Which discoveries have hidden technical complexity that the ranking may underestimate?",
        "What criteria did you use to evaluate gains vs pains quantitatively?",
      ],
      explanation:
        "At mid level, brainstorming analysis goes beyond listing to finding systemic patterns, defining MVP scope, and stress-testing assumptions with data.",
      key_decisions: ["MVP scope definition", "Systemic patterns identified", "Feasibility thresholds"],
    },
    senior: {
      objectives: [
        "Challenge the ranking methodology for hidden biases",
        "Identify strategic bets vs incremental improvements",
        "Design the discovery pipeline for future sprints",
        "Assess competitive and market implications of top opportunities",
        "Define success metrics tied to discoveries",
      ],
      questions: [
        "What biases might be embedded in the pain/gain scoring methodology?",
        "Which discoveries represent strategic bets versus incremental improvements, and how does that affect prioritization?",
        "How would you redesign the brainstorming process to surface higher-quality discoveries faster?",
        "What market or competitive signals validate or contradict the top-ranked discoveries?",
      ],
      explanation:
        "Senior developers should challenge the process itself, not just the outputs. Brainstorming methodology design and strategic framing are key competencies at this level.",
      key_decisions: [
        "Strategic vs incremental split",
        "Discovery pipeline design",
        "Success metric definition",
        "Competitive positioning",
      ],
    },
  },
  specs: {
    beginner: {
      objectives: [
        "Understand what a spec document contains",
        "Learn the difference between a spec and a PRP",
        "Identify the main sections of a spec",
      ],
      questions: [
        "What is the purpose of writing a spec before coding?",
        "What is one thing a spec tells developers that code comments do not?",
      ],
      explanation:
        "Spec documents translate discovery insights into structured requirements. They define what to build without prescribing how to build it.",
      key_decisions: ["Spec format", "Acceptance criteria"],
    },
    junior: {
      objectives: [
        "Write clear acceptance criteria for a feature",
        "Identify gaps between spec and implementation",
        "Map specs to data model decisions",
        "Review specs for ambiguity",
      ],
      questions: [
        "How do you verify that an acceptance criterion is testable?",
        "What data model decisions are implied by this spec?",
        "Where do you see ambiguity in the spec that could cause implementation divergence?",
      ],
      explanation:
        "Junior developers should practice translating specs into acceptance criteria and spotting ambiguities before coding begins.",
      key_decisions: ["Acceptance criteria format", "Data model implications", "Ambiguity resolution"],
    },
    mid: {
      objectives: [
        "Evaluate spec completeness using checklist criteria",
        "Identify missing edge cases in acceptance criteria",
        "Design review workflow for spec quality",
        "Map cross-spec dependencies",
        "Prioritize specs by implementation risk",
      ],
      questions: [
        "What edge cases are missing from the acceptance criteria in this spec?",
        "How do the specs interact with each other, and where could a change in one break another?",
        "What is the highest-risk spec to implement and why?",
        "How would you design a review process to catch spec ambiguity before coding?",
      ],
      explanation:
        "Mid-level developers should be able to audit spec quality, find cross-spec dependencies, and quantify implementation risk.",
      key_decisions: ["Edge case coverage", "Cross-spec dependency map", "Risk ranking"],
    },
    senior: {
      objectives: [
        "Design the spec review scoring framework",
        "Identify specs that require architectural decisions",
        "Evaluate trade-offs between flexibility and specificity in specs",
        "Define spec versioning and change management policy",
        "Assess long-term maintainability implications of spec decisions",
      ],
      questions: [
        "Which specs require architectural decisions that cannot be deferred to implementation?",
        "How should spec versioning work when requirements change mid-sprint?",
        "What trade-offs exist between over-specifying (rigid) and under-specifying (ambiguous)?",
        "How would you score spec quality in a repeatable, objective way?",
      ],
      explanation:
        "Senior engineers own the spec review process itself. They should design scoring frameworks, define change policies, and identify architectural commitments embedded in specs.",
      key_decisions: [
        "Review scoring framework",
        "Change management policy",
        "Architectural commitments",
        "Flexibility vs specificity trade-off",
      ],
    },
  },
  implementation: {
    beginner: {
      objectives: [
        "Understand the basic development loop (code, test, commit)",
        "Learn how to read an existing codebase",
        "Identify where to add new code without breaking existing functionality",
      ],
      questions: [
        "What steps did you follow before writing your first line of code?",
        "How did you verify your changes did not break anything?",
      ],
      explanation:
        "Implementation is where specs become code. The key habit to build at beginner level is reading before writing and testing incrementally.",
      key_decisions: ["Where to add code", "Test strategy"],
    },
    junior: {
      objectives: [
        "Apply the spec acceptance criteria as implementation checklist",
        "Write tests before or alongside implementation",
        "Handle error cases defined in the spec",
        "Keep commits atomic and well-described",
      ],
      questions: [
        "Which acceptance criteria were hardest to implement and why?",
        "How did you handle the error cases defined in the spec?",
        "Describe the commit strategy you used for this feature.",
      ],
      explanation:
        "Junior developers should practice spec-driven implementation, writing tests for each acceptance criterion and keeping commits atomic.",
      key_decisions: ["Test-first vs test-alongside", "Commit granularity", "Error handling strategy"],
    },
    mid: {
      objectives: [
        "Identify performance implications of implementation choices",
        "Refactor for maintainability without changing behavior",
        "Design APIs that are extensible but not over-engineered",
        "Evaluate security implications of implementation decisions",
        "Lead code review for junior implementation work",
      ],
      questions: [
        "What performance trade-offs did you make and why?",
        "Where did you defer abstraction to avoid over-engineering?",
        "What security considerations influenced your implementation choices?",
        "How would you structure a code review for the implementation you delivered?",
      ],
      explanation:
        "Mid-level implementation is about quality trade-offs: performance, maintainability, security, and extensibility must be balanced against delivery speed.",
      key_decisions: [
        "Performance trade-offs",
        "Abstraction deferral points",
        "Security mitigations",
        "Review process",
      ],
    },
    senior: {
      objectives: [
        "Define architecture patterns for the implementation layer",
        "Evaluate build-vs-buy decisions for key components",
        "Design for operational concerns (logging, monitoring, observability)",
        "Assess technical debt created by implementation decisions",
        "Set implementation standards for the team",
      ],
      questions: [
        "What architectural patterns did you choose and what alternatives did you reject?",
        "Where did this implementation create technical debt, and what is the remediation plan?",
        "How did you design for observability and operations, not just functionality?",
        "What implementation standards should the team adopt based on lessons from this feature?",
      ],
      explanation:
        "Senior engineers design implementation standards, not just implementations. They think about the codebase long-term and set patterns others will follow.",
      key_decisions: [
        "Architecture pattern choice",
        "Technical debt register",
        "Observability design",
        "Team standards",
      ],
    },
  },
  review: {
    beginner: {
      objectives: [
        "Understand what a code review is for",
        "Learn how to read and respond to review comments",
        "Identify common review feedback categories",
      ],
      questions: [
        "What is the purpose of a code review?",
        "How should you respond to a review comment you disagree with?",
      ],
      explanation:
        "Code review is a quality gate and learning opportunity. At beginner level, the focus is on understanding feedback and iterating constructively.",
      key_decisions: ["How to address feedback", "When to escalate disagreements"],
    },
    junior: {
      objectives: [
        "Self-review code before requesting peer review",
        "Address blocker feedback before suggestion feedback",
        "Document rationale for non-obvious implementation choices",
        "Track review iterations and their outcomes",
      ],
      questions: [
        "What did you find during your self-review before requesting peer review?",
        "How did you prioritize blocker vs suggestion feedback?",
        "Where did you document your rationale for non-obvious choices?",
      ],
      explanation:
        "Junior developers should build the habit of self-review and prioritizing blocking feedback before stylistic suggestions.",
      key_decisions: [
        "Self-review checklist",
        "Feedback prioritization",
        "Rationale documentation",
      ],
    },
    mid: {
      objectives: [
        "Conduct structured code reviews using a scoring rubric",
        "Distinguish blocker vs suggestion feedback consistently",
        "Identify patterns in recurring review issues",
        "Design review checklists for the team",
        "Measure review cycle time and identify bottlenecks",
      ],
      questions: [
        "What patterns did you notice in the review feedback across multiple features?",
        "How would you design a review checklist that catches the most common issues?",
        "What is the review cycle time for this feature and what caused delays?",
        "How do you distinguish blockers from suggestions in a consistent, objective way?",
      ],
      explanation:
        "Mid-level reviewers should systematize the review process, track patterns, and measure cycle time to identify process improvements.",
      key_decisions: [
        "Review scoring rubric",
        "Pattern tracking",
        "Cycle time benchmarks",
        "Checklist design",
      ],
    },
    senior: {
      objectives: [
        "Design the review process for the team",
        "Define quality gates that reviews must enforce",
        "Evaluate review automation vs human review trade-offs",
        "Measure review effectiveness at the team level",
        "Set review culture and norms",
      ],
      questions: [
        "What quality gates should every review enforce, and how do you verify they are applied consistently?",
        "Where can review automation replace human judgment without sacrificing quality?",
        "How do you measure whether the review process is achieving its quality goals?",
        "What cultural norms around code review would you establish for the team?",
      ],
      explanation:
        "Senior engineers own the review culture and process. They define quality gates, evaluate automation trade-offs, and measure effectiveness at the team level.",
      key_decisions: [
        "Quality gate definitions",
        "Automation boundaries",
        "Effectiveness metrics",
        "Team review norms",
      ],
    },
  },
};

const DEFAULT_PHASE_CONTENT: PhaseContent = {
  beginner: {
    objectives: [
      "Understand the goals of this phase",
      "Identify your main contribution in this phase",
      "Recognize what success looks like",
    ],
    questions: [
      "What was the main goal of this phase?",
      "What did you contribute and how did you verify it was correct?",
    ],
    explanation:
      "This phase is part of the structured development workflow. Understanding each phase helps build a mental model of how software is built collaboratively.",
    key_decisions: ["Phase goals", "Success criteria"],
  },
  junior: {
    objectives: [
      "Define the success criteria for this phase",
      "Identify the key decisions made during this phase",
      "Evaluate what could have been done differently",
      "Document lessons learned",
    ],
    questions: [
      "What were the most important decisions made during this phase?",
      "What would you do differently if you repeated this phase?",
      "What lessons from this phase apply to future work?",
    ],
    explanation:
      "Each phase generates artifacts and decisions that downstream phases depend on. Understanding these dependencies builds systems thinking.",
    key_decisions: ["Phase outputs", "Downstream dependencies", "Lessons learned"],
  },
  mid: {
    objectives: [
      "Evaluate phase quality against measurable criteria",
      "Identify process improvements for future iterations",
      "Map cross-phase dependencies and risks",
      "Quantify the impact of phase decisions on downstream work",
      "Design feedback loops for continuous improvement",
    ],
    questions: [
      "How would you measure the quality of the outputs from this phase objectively?",
      "What cross-phase dependencies created risk in this iteration?",
      "What process change would have the highest impact on phase quality?",
      "How did decisions in this phase affect the effort required in later phases?",
    ],
    explanation:
      "At mid level, the focus shifts from completing phase work to improving the process that generates the work. Measurement and feedback loops are key.",
    key_decisions: [
      "Quality metrics",
      "Cross-phase risks",
      "Process improvements",
      "Feedback loop design",
    ],
  },
  senior: {
    objectives: [
      "Redesign the phase workflow for higher throughput",
      "Define phase-level quality gates and enforcement",
      "Evaluate automation opportunities within the phase",
      "Assess the phase's contribution to overall product outcomes",
      "Set standards for phase execution across teams",
    ],
    questions: [
      "How would you redesign this phase to deliver higher quality with less effort?",
      "What automation opportunities exist within this phase that are currently manual?",
      "How does this phase's output connect to measurable product outcomes?",
      "What standards for this phase would you set for teams working in parallel?",
    ],
    explanation:
      "Senior engineers think about phases as components of a workflow system. They optimize the system, not just their own execution within it.",
    key_decisions: [
      "Workflow redesign",
      "Automation opportunities",
      "Product outcome connections",
      "Cross-team standards",
    ],
  },
};

function getPhaseContent(phase: string, level: ExperienceLevel) {
  const content = PHASE_CONTENT[phase] ?? DEFAULT_PHASE_CONTENT;
  return content[level];
}

function evaluateAnswer(question: string, answer: string, level: ExperienceLevel): { evaluation: string; passed: boolean } {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  // Thresholds by experience level
  const thresholds: Record<ExperienceLevel, { pass: number; deep: number }> = {
    beginner: { pass: 10, deep: 30 },
    junior: { pass: 20, deep: 50 },
    mid: { pass: 40, deep: 80 },
    senior: { pass: 60, deep: 100 },
  };

  const threshold = thresholds[level];

  if (wordCount >= threshold.deep) {
    return {
      evaluation: `Excellent response (${wordCount} words). Demonstrates deep understanding of "${question.substring(0, 50)}...". Key concepts addressed with nuance and depth appropriate for ${level} level.`,
      passed: true,
    };
  } else if (wordCount >= threshold.pass) {
    return {
      evaluation: `Satisfactory response (${wordCount} words). Covers the core concepts for "${question.substring(0, 50)}..." at a ${level} level. Consider adding more specific examples or trade-off analysis.`,
      passed: true,
    };
  } else {
    return {
      evaluation: `Insufficient depth (${wordCount} words). The question "${question.substring(0, 50)}..." requires more elaboration. A ${level}-level developer should provide at least ${threshold.pass} words with concrete reasoning.`,
      passed: false,
    };
  }
}

// --- Endpoints ---

const BASE = "/hub/projects/:projectId/mentoring/profiles/:profileId";

// GET /hub/projects/:projectId/mentoring/profiles/:profileId/checkpoints
learningCheckpoints.get(`${BASE}/checkpoints`, async (c) => {
  const projectId = c.req.param("projectId");
  const profileId = c.req.param("profileId");
  const phaseFilter = c.req.query("phase");
  const completedFilter = c.req.query("completed");

  const project = await loadProject(projectId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const profile = await loadProfile(projectId, profileId);
  if (!profile) return c.json({ error: "Profile not found" }, 404);

  let checkpoints = await loadAllCheckpoints(projectId);

  // Filter by profile
  checkpoints = checkpoints.filter((cp) => cp.profile_id === profileId);

  if (phaseFilter) {
    checkpoints = checkpoints.filter((cp) => cp.phase === phaseFilter);
  }

  if (completedFilter !== undefined) {
    const completedBool = completedFilter === "true";
    checkpoints = checkpoints.filter((cp) => cp.completed === completedBool);
  }

  return c.json(checkpoints);
});

// POST /hub/projects/:projectId/mentoring/profiles/:profileId/checkpoints/generate
learningCheckpoints.post(`${BASE}/checkpoints/generate`, async (c) => {
  const projectId = c.req.param("projectId");
  const profileId = c.req.param("profileId");

  const project = await loadProject(projectId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const profile = await loadProfile(projectId, profileId);
  if (!profile) return c.json({ error: "Profile not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = GenerateCheckpointBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const { phase } = parsed.data;
  const level = profile.experience_level;
  const content = getPhaseContent(phase, level);

  const id = randomUUID();
  const now = new Date().toISOString();

  const checkpoint: LearningCheckpoint = {
    id,
    project_id: project.id,
    profile_id: profileId,
    phase,
    learning_objectives: content.objectives,
    questions: content.questions.map((q) => ({
      question: q,
      developer_answer: null,
      ai_evaluation: null,
      passed: null,
    })),
    phase_explanation: content.explanation,
    key_decisions: content.key_decisions,
    completed: false,
    created_at: now,
    completed_at: null,
  };

  const validated = LearningCheckpointSchema.safeParse(checkpoint);
  if (!validated.success) {
    return c.json({ error: "Checkpoint construction failed", details: validated.error.issues }, 500);
  }

  await ensureDir(checkpointsDir(projectId));
  await writeJSON(checkpointPath(projectId, id), validated.data);

  return c.json(validated.data, 201);
});

// POST /hub/projects/:projectId/mentoring/profiles/:profileId/checkpoints/:checkpointId/submit
learningCheckpoints.post(`${BASE}/checkpoints/:checkpointId/submit`, async (c) => {
  const projectId = c.req.param("projectId");
  const profileId = c.req.param("profileId");
  const checkpointId = c.req.param("checkpointId");

  const project = await loadProject(projectId);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const profile = await loadProfile(projectId, profileId);
  if (!profile) return c.json({ error: "Profile not found" }, 404);

  let existing: LearningCheckpoint;
  try {
    existing = await readJSON<LearningCheckpoint>(checkpointPath(projectId, checkpointId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return c.json({ error: "Checkpoint not found" }, 404);
    }
    throw err;
  }

  if (existing.profile_id !== profileId) {
    return c.json({ error: "Checkpoint does not belong to this profile" }, 403);
  }

  if (existing.completed) {
    return c.json({ error: "Checkpoint already completed" }, 409);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = SubmitCheckpointBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Invalid body", details: parsed.error.issues }, 400);
  }

  const { answers } = parsed.data;
  const level = profile.experience_level;

  // Apply answers and evaluate
  const updatedQuestions = existing.questions.map((q, idx) => {
    const answer = answers.find((a) => a.question_index === idx);
    if (!answer) return q;

    const { evaluation, passed } = evaluateAnswer(q.question, answer.answer, level);
    return {
      ...q,
      developer_answer: answer.answer,
      ai_evaluation: evaluation,
      passed,
    };
  });

  const now = new Date().toISOString();

  const updated: LearningCheckpoint = {
    ...existing,
    questions: updatedQuestions,
    completed: true,
    completed_at: now,
  };

  await writeJSON(checkpointPath(projectId, checkpointId), updated);

  return c.json(updated);
});

export { learningCheckpoints };

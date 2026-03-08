import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { readdir } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import {
  ReviewPipelineSchema,
  CreateReviewPipelineBodySchema,
  TriggerReviewBodySchema,
  type ReviewPipeline,
  type AgentConfig,
  type AgentResult,
  type Finding,
} from "../schemas/review-pipeline.js";
import { type Project } from "../schemas/project.js";

const reviewPipelines = new Hono();

// In-memory event bus for review SSE events (keyed by project slug)
const reviewEventBus = new EventEmitter();
reviewEventBus.setMaxListeners(100);

// ---- helpers ----

function projectDir(slug: string): string {
  return path.join(config.projectsDir, slug);
}

function reviewPipelinesDir(slug: string): string {
  return path.join(projectDir(slug), "review-pipelines");
}

function reviewPipelinePath(slug: string, reviewId: string): string {
  return path.join(reviewPipelinesDir(slug), `${reviewId}.json`);
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

async function loadReviewPipeline(
  slug: string,
  reviewId: string,
): Promise<ReviewPipeline | null> {
  try {
    return await readJSON<ReviewPipeline>(reviewPipelinePath(slug, reviewId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveReviewPipeline(
  slug: string,
  review: ReviewPipeline,
): Promise<void> {
  await ensureDir(reviewPipelinesDir(slug));
  await writeJSON(reviewPipelinePath(slug, review.id), review);
}

async function listAllReviewPipelines(slug: string): Promise<ReviewPipeline[]> {
  const dir = reviewPipelinesDir(slug);
  let files: string[];
  try {
    const entries = await readdir(dir);
    files = entries.filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }

  const results: ReviewPipeline[] = [];
  for (const file of files) {
    try {
      const review = await readJSON<ReviewPipeline>(path.join(dir, file));
      results.push(review);
    } catch {
      // skip corrupted files
    }
  }

  return results.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

const DEFAULT_AGENTS_CONFIG: AgentConfig[] = [
  { type: "security", enabled: true, priority: 1 },
  { type: "quality", enabled: true, priority: 2 },
  { type: "spec_compliance", enabled: true, priority: 3 },
  { type: "architecture", enabled: true, priority: 4 },
];

/** Mock agent review simulation — runs async without blocking. */
function simulateReview(slug: string, review: ReviewPipeline): void {
  setImmediate(async () => {
    try {
      // Transition to running
      review.status = "running";
      review.started_at = new Date().toISOString();
      await saveReviewPipeline(slug, review);

      const enabledAgents = review.agents_config
        .filter((a) => a.enabled)
        .sort((a, b) => a.priority - b.priority);

      const mockResults: AgentResult[] = [];

      for (const agent of enabledAgents) {
        // Mock findings per agent type
        const findings: Finding[] =
          agent.type === "security"
            ? [
                {
                  severity: "high",
                  file: "src/app.ts",
                  line: 42,
                  message: "Potential SQL injection via unsanitized input",
                  suggestion: "Use parameterized queries or ORM",
                },
              ]
            : [];

        const critical = findings.filter((f) => f.severity === "critical").length;
        const agentStatus = critical > 0 ? ("fail" as const) : ("pass" as const);

        const result: AgentResult = {
          agent_type: agent.type,
          status: agentStatus,
          findings_count: findings.length,
          critical_findings: critical,
          summary: `${agent.type} review completed. ${findings.length} finding(s) detected.`,
          findings,
          duration_seconds: Math.floor(Math.random() * 10) + 2,
        };

        mockResults.push(result);
        review.results = [...mockResults];
        await saveReviewPipeline(slug, review);

        reviewEventBus.emit(`review:${slug}`, {
          event: "review:agent-completed",
          data: { review_id: review.id, agent_type: agent.type, result },
        });
      }

      // Determine verdict
      const hasFail = mockResults.some((r) => r.status === "fail");
      const hasCritical = mockResults.some((r) => r.critical_findings > 0);
      let verdict: ReviewPipeline["overall_verdict"] = "pass";
      let humanReviewRequired = false;
      let humanReviewReason: string | null = null;

      if (hasCritical) {
        verdict = "fail";
      } else if (hasFail) {
        verdict = "needs_human_review";
        humanReviewRequired = true;
        humanReviewReason = "One or more agents reported findings requiring human review.";
      }

      review.status = "completed";
      review.overall_verdict = verdict;
      review.human_review_required = humanReviewRequired;
      review.human_review_reason = humanReviewReason;
      review.completed_at = new Date().toISOString();
      await saveReviewPipeline(slug, review);

      reviewEventBus.emit(`review:${slug}`, {
        event: "review:completed",
        data: { review_id: review.id, verdict, human_review_required: humanReviewRequired },
      });
    } catch {
      // Simulation errors should not crash the process
      review.status = "failed";
      try {
        await saveReviewPipeline(slug, review);
      } catch {
        // ignore
      }
    }
  });
}

// ---- routes ----

// GET /hub/projects/:projectId/review-pipelines — list reviews with optional ?status= and ?feature_id= filters
reviewPipelines.get("/hub/projects/:projectId/review-pipelines", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let all = await listAllReviewPipelines(slug);

  const statusFilter = c.req.query("status");
  if (statusFilter) {
    all = all.filter((r) => r.status === statusFilter);
  }

  const featureIdFilter = c.req.query("feature_id");
  if (featureIdFilter) {
    all = all.filter((r) => r.feature_id === featureIdFilter);
  }

  return c.json(all);
});

// POST /hub/projects/:projectId/review-pipelines — create manual ReviewPipeline
reviewPipelines.post("/hub/projects/:projectId/review-pipelines", async (c) => {
  const slug = c.req.param("projectId");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateReviewPipelineBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const { feature_id, agents_config, trigger } = parsed.data;
  const id = randomUUID();
  const now = new Date().toISOString();

  const review: ReviewPipeline = ReviewPipelineSchema.parse({
    id,
    project_id: project.id,
    feature_id: feature_id ?? null,
    trigger: trigger ?? "manual",
    status: "queued",
    agents_config: agents_config ?? DEFAULT_AGENTS_CONFIG,
    results: [],
    overall_verdict: null,
    human_review_required: false,
    human_review_reason: null,
    started_at: null,
    completed_at: null,
    created_at: now,
  });

  await saveReviewPipeline(slug, review);

  // Emit review:started and kick off simulation
  reviewEventBus.emit(`review:${slug}`, {
    event: "review:started",
    data: { review_id: id, feature_id: review.feature_id, trigger: review.trigger },
  });
  simulateReview(slug, review);

  return c.json(review, 201);
});

// GET /hub/projects/:projectId/review-pipelines/stream — SSE stream for review events
reviewPipelines.get(
  "/hub/projects/:projectId/review-pipelines/stream",
  (c) => {
    const slug = c.req.param("projectId");

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({ project: slug, timestamp: new Date().toISOString() }),
      });

      const listener = async (payload: { event: string; data: unknown }) => {
        try {
          await stream.writeSSE({
            event: payload.event,
            data: JSON.stringify(payload.data),
          });
        } catch {
          // Client disconnected
        }
      };

      reviewEventBus.on(`review:${slug}`, listener);

      stream.onAbort(() => {
        reviewEventBus.off(`review:${slug}`, listener);
      });

      // Heartbeat loop
      while (true) {
        try {
          await stream.writeSSE({
            event: "heartbeat",
            data: JSON.stringify({ timestamp: new Date().toISOString() }),
          });
          await stream.sleep(30000);
        } catch {
          break;
        }
      }

      reviewEventBus.off(`review:${slug}`, listener);
    });
  },
);

// POST /hub/projects/:projectId/review-pipelines/trigger — trigger review for a feature
reviewPipelines.post(
  "/hub/projects/:projectId/review-pipelines/trigger",
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

    const parsed = TriggerReviewBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400,
      );
    }

    const { feature_id } = parsed.data;
    const id = randomUUID();
    const now = new Date().toISOString();

    const review: ReviewPipeline = ReviewPipelineSchema.parse({
      id,
      project_id: project.id,
      feature_id: feature_id ?? null,
      trigger: "automatic",
      status: "queued",
      agents_config: DEFAULT_AGENTS_CONFIG,
      results: [],
      overall_verdict: null,
      human_review_required: false,
      human_review_reason: null,
      started_at: null,
      completed_at: null,
      created_at: now,
    });

    await saveReviewPipeline(slug, review);

    // Emit review:started and kick off simulation
    reviewEventBus.emit(`review:${slug}`, {
      event: "review:started",
      data: { review_id: id, feature_id: review.feature_id, trigger: "automatic" },
    });
    simulateReview(slug, review);

    return c.json(review, 201);
  },
);

// GET /hub/projects/:projectId/review-pipelines/:reviewId — get single review
reviewPipelines.get(
  "/hub/projects/:projectId/review-pipelines/:reviewId",
  async (c) => {
    const slug = c.req.param("projectId");
    const reviewId = c.req.param("reviewId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const review = await loadReviewPipeline(slug, reviewId);
    if (!review) return c.json({ error: "Review not found" }, 404);

    return c.json(review);
  },
);

export { reviewPipelines };

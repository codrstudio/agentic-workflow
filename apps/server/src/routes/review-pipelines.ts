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
  ReviewConfigSchema,
  UpdateReviewConfigBodySchema,
  ReviewQueueMetricsSchema,
  MetricsCacheSchema,
  type ReviewPipeline,
  type AgentConfig,
  type AgentResult,
  type Finding,
  type ReviewConfig,
  type ReviewQueueMetrics,
  type MetricsCache,
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
    const EXCLUDED = new Set(["config.json", "queue-metrics-cache.json"]);
    files = entries.filter((f) => f.endsWith(".json") && !EXCLUDED.has(f));
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

// ---- Config helpers ----

function reviewConfigPath(slug: string): string {
  return path.join(projectDir(slug), "review-pipelines", "config.json");
}

function metricsCachePath(slug: string): string {
  return path.join(projectDir(slug), "review-pipelines", "queue-metrics-cache.json");
}

const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  agents_config: DEFAULT_AGENTS_CONFIG,
  auto_trigger: false,
  updated_at: null,
};

async function loadReviewConfig(slug: string): Promise<ReviewConfig> {
  try {
    return await readJSON<ReviewConfig>(reviewConfigPath(slug));
  } catch {
    return DEFAULT_REVIEW_CONFIG;
  }
}

async function saveReviewConfig(slug: string, config: ReviewConfig): Promise<void> {
  await ensureDir(path.join(projectDir(slug), "review-pipelines"));
  await writeJSON(reviewConfigPath(slug), config);
}

// ---- Metrics computation ----

const METRICS_TTL_MS = 5 * 60 * 1000; // 5 minutes

function computeMetrics(reviews: ReviewPipeline[]): ReviewQueueMetrics {
  const queuedOrRunning = reviews.filter(
    (r) => r.status === "queued" || r.status === "running",
  );

  const completed = reviews.filter((r) => r.status === "completed");

  // avg_wait_time_minutes: avg (started_at - created_at) for reviews that started
  const started = reviews.filter((r) => r.started_at !== null);
  const avgWait =
    started.length > 0
      ? started.reduce((acc, r) => {
          const wait =
            (new Date(r.started_at!).getTime() -
              new Date(r.created_at).getTime()) /
            60000;
          return acc + wait;
        }, 0) / started.length
      : 0;

  // avg_review_duration_minutes: avg (completed_at - started_at)
  const completedWithBoth = completed.filter(
    (r) => r.started_at !== null && r.completed_at !== null,
  );
  const avgDuration =
    completedWithBoth.length > 0
      ? completedWithBoth.reduce((acc, r) => {
          const dur =
            (new Date(r.completed_at!).getTime() -
              new Date(r.started_at!).getTime()) /
            60000;
          return acc + dur;
        }, 0) / completedWithBoth.length
      : 0;

  // pass_rate and escalation_rate
  const passRate =
    completed.length > 0
      ? (completed.filter((r) => r.overall_verdict === "pass").length /
          completed.length) *
        100
      : 0;

  const escalationRate =
    completed.length > 0
      ? (completed.filter((r) => r.human_review_required).length /
          completed.length) *
        100
      : 0;

  // findings_by_severity
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const review of reviews) {
    for (const result of review.results) {
      for (const finding of result.findings) {
        const sev = finding.severity as keyof typeof bySeverity;
        if (sev in bySeverity) bySeverity[sev]++;
      }
    }
  }

  // findings_by_agent
  const agentTypes = ["security", "quality", "spec_compliance", "architecture"] as const;
  const byAgent = agentTypes.map((agentType) => {
    const agentResults = reviews.flatMap((r) =>
      r.results.filter((res) => res.agent_type === agentType),
    );
    const reviewsWithAgent = agentResults.length;
    const totalFindings = agentResults.reduce(
      (acc, res) => acc + res.findings_count,
      0,
    );
    const criticalFindings = agentResults.reduce(
      (acc, res) => acc + res.critical_findings,
      0,
    );
    return {
      agent_type: agentType,
      total_findings: totalFindings,
      critical_findings: criticalFindings,
      avg_findings_per_review:
        reviewsWithAgent > 0 ? totalFindings / reviewsWithAgent : 0,
    };
  });

  return ReviewQueueMetricsSchema.parse({
    queue_size: queuedOrRunning.length,
    avg_wait_time_minutes: Math.round(avgWait * 100) / 100,
    avg_review_duration_minutes: Math.round(avgDuration * 100) / 100,
    pass_rate: Math.round(passRate * 100) / 100,
    escalation_rate: Math.round(escalationRate * 100) / 100,
    false_positive_rate: 0,
    findings_by_severity: bySeverity,
    findings_by_agent: byAgent,
    computed_at: new Date().toISOString(),
  });
}

async function loadCachedMetrics(slug: string): Promise<ReviewQueueMetrics | null> {
  try {
    const cache = await readJSON<MetricsCache>(metricsCachePath(slug));
    const age = Date.now() - new Date(cache.cached_at).getTime();
    if (age < METRICS_TTL_MS) return cache.metrics;
    return null;
  } catch {
    return null;
  }
}

async function saveCachedMetrics(slug: string, metrics: ReviewQueueMetrics): Promise<void> {
  const cache: MetricsCache = MetricsCacheSchema.parse({
    metrics,
    cached_at: new Date().toISOString(),
  });
  await ensureDir(path.join(projectDir(slug), "review-pipelines"));
  await writeJSON(metricsCachePath(slug), cache);
}

// ---- Config routes ----

// GET /hub/projects/:projectId/review-pipelines/config
reviewPipelines.get(
  "/hub/projects/:projectId/review-pipelines/config",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    const reviewConfig = await loadReviewConfig(slug);
    return c.json(reviewConfig);
  },
);

// PUT /hub/projects/:projectId/review-pipelines/config
reviewPipelines.put(
  "/hub/projects/:projectId/review-pipelines/config",
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

    const parsed = UpdateReviewConfigBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        400,
      );
    }

    const existing = await loadReviewConfig(slug);
    const updated: ReviewConfig = ReviewConfigSchema.parse({
      agents_config: parsed.data.agents_config ?? existing.agents_config,
      auto_trigger:
        parsed.data.auto_trigger !== undefined
          ? parsed.data.auto_trigger
          : existing.auto_trigger,
      updated_at: new Date().toISOString(),
    });

    await saveReviewConfig(slug, updated);
    return c.json(updated);
  },
);

// ---- Metrics route ----

// GET /hub/projects/:projectId/review-pipelines/metrics
reviewPipelines.get(
  "/hub/projects/:projectId/review-pipelines/metrics",
  async (c) => {
    const slug = c.req.param("projectId");
    const project = await loadProject(slug);
    if (!project) return c.json({ error: "Project not found" }, 404);

    // Try cache first
    const cached = await loadCachedMetrics(slug);
    if (cached) return c.json(cached);

    // Compute fresh metrics
    const allReviews = await listAllReviewPipelines(slug);
    const metrics = computeMetrics(allReviews);

    await saveCachedMetrics(slug, metrics);
    return c.json(metrics);
  },
);

// GET /hub/projects/:projectId/review-pipelines/:reviewId — get single review
// NOTE: must be registered AFTER /config and /metrics to avoid wildcard collision
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

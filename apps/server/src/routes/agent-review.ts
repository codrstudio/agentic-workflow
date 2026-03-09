import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { spawnClaudeStream } from "../lib/claude-client.js";
import { config } from "../lib/config.js";
import { type Review } from "../schemas/review.js";

const execFileAsync = promisify(execFile);

// --- Types ---

type ReviewAgentType = "correctness" | "security" | "performance" | "standards";

interface ReviewAgent {
  type: ReviewAgentType;
  name: string;
  description: string;
  system_prompt: string;
  enabled: boolean;
}

type ReviewAgentsConfig = Record<ReviewAgentType, ReviewAgent>;

interface ReviewFinding {
  id: string;
  agent_type: ReviewAgentType;
  severity: "critical" | "warning" | "info";
  file_path: string;
  line_start?: number;
  line_end?: number;
  title: string;
  description: string;
  suggestion?: string;
  dismissed: boolean;
}

interface AgentReviewResult {
  id: string;
  review_id: string;
  agent_type: ReviewAgentType;
  status: "pending" | "running" | "completed" | "failed";
  findings: ReviewFinding[];
  summary?: string;
  tokens_used: number;
  duration_ms: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

interface ReviewWithAgentReviews extends Review {
  agent_reviews?: AgentReviewResult[];
  agent_review_requested?: boolean;
}

// --- Constants ---

const AGENT_TYPES: ReviewAgentType[] = [
  "correctness",
  "security",
  "performance",
  "standards",
];

const DEFAULT_AGENTS: ReviewAgentsConfig = {
  correctness: {
    type: "correctness",
    name: "Correctness",
    description:
      "Analisa logica, bugs, edge cases e comportamento incorreto no codigo.",
    system_prompt:
      "Voce e um revisor especializado em correctness. Analise o diff fornecido e identifique bugs, erros de logica, edge cases nao tratados e comportamento incorreto. Seja preciso e objetivo.",
    enabled: true,
  },
  security: {
    type: "security",
    name: "Security",
    description:
      "Detecta vulnerabilidades, problemas OWASP, injection e falhas de seguranca.",
    system_prompt:
      "Voce e um revisor especializado em seguranca. Analise o diff fornecido e identifique vulnerabilidades, problemas OWASP top 10, injection, exposicao de dados sensiveis e falhas de autenticacao/autorizacao. Seja preciso e objetivo.",
    enabled: true,
  },
  performance: {
    type: "performance",
    name: "Performance",
    description:
      "Identifica problemas de complexidade, memory leaks, N+1 queries e gargalos.",
    system_prompt:
      "Voce e um revisor especializado em performance. Analise o diff fornecido e identifique problemas de complexidade algoritmica, memory leaks, N+1 queries, renderizacoes desnecessarias e gargalos de performance. Seja preciso e objetivo.",
    enabled: true,
  },
  standards: {
    type: "standards",
    name: "Standards",
    description:
      "Verifica convencoes, naming, patterns do projeto e boas praticas.",
    system_prompt:
      "Voce e um revisor especializado em padroes e convencoes. Analise o diff fornecido e identifique violacoes de naming conventions, patterns inconsistentes, codigo duplicado e desvios das boas praticas do projeto. Seja preciso e objetivo.",
    enabled: true,
  },
};

// --- SSE Event Bus ---

const agentReviewBus = new EventEmitter();
agentReviewBus.setMaxListeners(100);

interface AgentReviewEvent {
  type: "agent:started" | "agent:finding" | "agent:completed" | "agent:failed";
  review_id: string;
  agent_type: ReviewAgentType;
  data?: unknown;
}

function emitAgentEvent(reviewId: string, event: AgentReviewEvent): void {
  agentReviewBus.emit(`agent-review:${reviewId}`, event);
}

// --- Helpers ---

function agentConfigPath(slug: string): string {
  return path.join(config.projectsDir, slug, "review-agents", "config.json");
}

function reviewPath(slug: string, reviewId: string): string {
  return path.join(config.projectsDir, slug, "reviews", `${reviewId}.json`);
}

async function loadAgentConfig(slug: string): Promise<ReviewAgentsConfig> {
  try {
    const data = await readJSON<ReviewAgentsConfig>(agentConfigPath(slug));
    const merged = { ...DEFAULT_AGENTS };
    for (const agentType of AGENT_TYPES) {
      if (data[agentType]) {
        merged[agentType] = { ...DEFAULT_AGENTS[agentType], ...data[agentType] };
      }
    }
    return merged;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return { ...DEFAULT_AGENTS };
    }
    throw err;
  }
}

async function loadReview(
  slug: string,
  reviewId: string
): Promise<ReviewWithAgentReviews | null> {
  try {
    return await readJSON<ReviewWithAgentReviews>(reviewPath(slug, reviewId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function saveReview(
  slug: string,
  review: ReviewWithAgentReviews
): Promise<void> {
  await ensureDir(path.join(config.projectsDir, slug, "reviews"));
  await writeJSON(reviewPath(slug, review.id), review);
}

async function getUnifiedDiff(slug: string): Promise<string> {
  const wsDir = path.join(config.workspacesDir, slug);
  const repoDir = path.join(wsDir, "repo");

  try {
    const s = await stat(repoDir);
    if (!s.isDirectory()) return "";
  } catch {
    return "";
  }

  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "HEAD~1", "HEAD"],
      { cwd: repoDir, timeout: 30000 }
    );
    return stdout;
  } catch {
    return "";
  }
}

// --- Findings parser ---

const FINDINGS_JSON_INSTRUCTION = `
Retorne sua analise EXCLUSIVAMENTE como um objeto JSON valido no seguinte formato (sem texto adicional antes ou depois):

{
  "findings": [
    {
      "severity": "critical" | "warning" | "info",
      "file_path": "caminho/do/arquivo.ts",
      "line_start": 10,
      "line_end": 15,
      "title": "Titulo curto do problema",
      "description": "Descricao detalhada do problema encontrado",
      "suggestion": "Sugestao de correcao (opcional)"
    }
  ],
  "summary": "Resumo da analise em 1-2 frases"
}

Se nao encontrar problemas, retorne { "findings": [], "summary": "Nenhum problema encontrado." }
`;

interface ParsedAgentResponse {
  findings: Array<{
    severity?: string;
    file_path?: string;
    line_start?: number;
    line_end?: number;
    title?: string;
    description?: string;
    suggestion?: string;
  }>;
  summary?: string;
}

function parseAgentResponse(
  text: string,
  agentType: ReviewAgentType,
  reviewId: string
): { findings: ReviewFinding[]; summary: string } {
  // Try to extract JSON from the response
  let parsed: ParsedAgentResponse | undefined;

  // Try direct parse first
  try {
    parsed = JSON.parse(text) as ParsedAgentResponse;
  } catch {
    // Try extracting JSON from markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonMatch?.[1]) {
      try {
        parsed = JSON.parse(jsonMatch[1]) as ParsedAgentResponse;
      } catch {
        // ignore
      }
    }

    // Try finding JSON object in text
    if (!parsed) {
      const braceMatch = text.match(/\{[\s\S]*\}/);
      if (braceMatch?.[0]) {
        try {
          parsed = JSON.parse(braceMatch[0]) as ParsedAgentResponse;
        } catch {
          // ignore
        }
      }
    }
  }

  if (!parsed || !Array.isArray(parsed.findings)) {
    return {
      findings: [],
      summary: parsed?.summary ?? "Analise concluida sem findings estruturados.",
    };
  }

  const validSeverities = new Set(["critical", "warning", "info"]);

  const findings: ReviewFinding[] = parsed.findings
    .filter(
      (f) =>
        f &&
        typeof f.title === "string" &&
        typeof f.description === "string"
    )
    .map((f) => ({
      id: randomUUID(),
      agent_type: agentType,
      severity: validSeverities.has(f.severity ?? "")
        ? (f.severity as "critical" | "warning" | "info")
        : "info",
      file_path: typeof f.file_path === "string" ? f.file_path : "",
      line_start: typeof f.line_start === "number" ? f.line_start : undefined,
      line_end: typeof f.line_end === "number" ? f.line_end : undefined,
      title: f.title!,
      description: f.description!,
      suggestion: typeof f.suggestion === "string" ? f.suggestion : undefined,
      dismissed: false,
    }));

  return {
    findings,
    summary: parsed.summary ?? `${findings.length} finding(s) encontrado(s).`,
  };
}

// --- Agent execution ---

function executeAgent(
  agentType: ReviewAgentType,
  agentConfig: ReviewAgent,
  diff: string,
  reviewId: string,
  result: AgentReviewResult,
  slug: string
): Promise<void> {
  return new Promise<void>((resolve) => {
    const startTime = Date.now();
    result.status = "running";
    result.started_at = new Date().toISOString();

    emitAgentEvent(reviewId, {
      type: "agent:started",
      review_id: reviewId,
      agent_type: agentType,
      data: { started_at: result.started_at },
    });

    const prompt = `${agentConfig.system_prompt}

${FINDINGS_JSON_INSTRUCTION}

--- DIFF ---

${diff}`;

    spawnClaudeStream(
      {
        prompt,
        maxTurns: 1,
        allowedTools: [],
      },
      {
        onDelta: () => {
          // We don't stream individual deltas for agent review
        },
        onComplete: async (fullText) => {
          try {
            const elapsed = Date.now() - startTime;
            const { findings, summary } = parseAgentResponse(
              fullText,
              agentType,
              reviewId
            );

            result.status = "completed";
            result.findings = findings;
            result.summary = summary;
            result.tokens_used = Math.ceil(fullText.length / 4);
            result.duration_ms = elapsed;
            result.completed_at = new Date().toISOString();

            // Emit finding events
            for (const finding of findings) {
              emitAgentEvent(reviewId, {
                type: "agent:finding",
                review_id: reviewId,
                agent_type: agentType,
                data: finding,
              });
            }

            emitAgentEvent(reviewId, {
              type: "agent:completed",
              review_id: reviewId,
              agent_type: agentType,
              data: {
                findings_count: findings.length,
                summary,
                tokens_used: result.tokens_used,
                duration_ms: elapsed,
              },
            });

            // Persist results
            try {
              const review = await loadReview(slug, reviewId);
              if (review) {
                const existing = review.agent_reviews ?? [];
                const idx = existing.findIndex(
                  (r) => r.agent_type === agentType
                );
                if (idx >= 0) {
                  existing[idx] = result;
                } else {
                  existing.push(result);
                }
                review.agent_reviews = existing;
                await saveReview(slug, review);
              }
            } catch {
              // persist failure is non-fatal
            }
          } catch {
            result.status = "failed";
            result.error = "Failed to parse agent response";
            result.duration_ms = Date.now() - startTime;
            result.completed_at = new Date().toISOString();

            emitAgentEvent(reviewId, {
              type: "agent:failed",
              review_id: reviewId,
              agent_type: agentType,
              data: { error: result.error },
            });
          }
          resolve();
        },
        onError: async (error) => {
          result.status = "failed";
          result.error = error;
          result.duration_ms = Date.now() - startTime;
          result.completed_at = new Date().toISOString();

          emitAgentEvent(reviewId, {
            type: "agent:failed",
            review_id: reviewId,
            agent_type: agentType,
            data: { error },
          });

          // Persist failure
          try {
            const review = await loadReview(slug, reviewId);
            if (review) {
              const existing = review.agent_reviews ?? [];
              const idx = existing.findIndex(
                (r) => r.agent_type === agentType
              );
              if (idx >= 0) {
                existing[idx] = result;
              } else {
                existing.push(result);
              }
              review.agent_reviews = existing;
              await saveReview(slug, review);
            }
          } catch {
            // persist failure is non-fatal
          }
          resolve();
        },
      }
    );
  });
}

// --- Routes ---

const agentReview = new Hono();

// POST /hub/projects/:slug/reviews/:reviewId/agent-review
agentReview.post(
  "/hub/projects/:slug/reviews/:reviewId/agent-review",
  async (c) => {
    const slug = c.req.param("slug");
    const reviewId = c.req.param("reviewId");

    const review = await loadReview(slug, reviewId);
    if (!review) return c.json({ error: "Review not found" }, 404);

    const agentsCfg = await loadAgentConfig(slug);

    let body: { agent_types?: string[] } = {};
    try {
      body = await c.req.json();
    } catch {
      // no body = use defaults
    }

    // Determine which agents to run
    const requestedTypes: ReviewAgentType[] = body.agent_types
      ? (body.agent_types.filter((t) =>
          AGENT_TYPES.includes(t as ReviewAgentType)
        ) as ReviewAgentType[])
      : AGENT_TYPES.filter((t) => agentsCfg[t].enabled);

    if (requestedTypes.length === 0) {
      return c.json({ error: "No valid agent types requested" }, 400);
    }

    // Create AgentReviewResult for each agent
    const agentReviews: AgentReviewResult[] = requestedTypes.map((t) => ({
      id: randomUUID(),
      review_id: reviewId,
      agent_type: t,
      status: "pending" as const,
      findings: [],
      tokens_used: 0,
      duration_ms: 0,
    }));

    // Save initial state
    review.agent_reviews = agentReviews;
    review.agent_review_requested = true;
    review.updated_at = new Date().toISOString();
    await saveReview(slug, review);

    // Get diff for the review
    const diff = await getUnifiedDiff(slug);

    // Execute agents in parallel (fire and forget)
    const executions = agentReviews.map((result) =>
      executeAgent(
        result.agent_type,
        agentsCfg[result.agent_type],
        diff,
        reviewId,
        result,
        slug
      )
    );

    // Don't await — let them run in background
    Promise.allSettled(executions).catch(() => {
      // swallow unhandled rejections
    });

    return c.json({ agent_reviews: agentReviews });
  }
);

// GET /hub/projects/:slug/reviews/:reviewId/agent-review/stream
agentReview.get(
  "/hub/projects/:slug/reviews/:reviewId/agent-review/stream",
  (c) => {
    const reviewId = c.req.param("reviewId");

    return streamSSE(c, async (stream) => {
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({
          review_id: reviewId,
          timestamp: new Date().toISOString(),
        }),
      });

      const listener = async (event: AgentReviewEvent) => {
        try {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event),
          });
        } catch {
          // Client disconnected
        }
      };

      agentReviewBus.on(`agent-review:${reviewId}`, listener);

      stream.onAbort(() => {
        agentReviewBus.off(`agent-review:${reviewId}`, listener);
      });

      // Heartbeat to keep connection alive
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
    });
  }
);

// GET /hub/projects/:slug/reviews/:reviewId/agent-review/:agentType
agentReview.get(
  "/hub/projects/:slug/reviews/:reviewId/agent-review/:agentType",
  async (c) => {
    const slug = c.req.param("slug");
    const reviewId = c.req.param("reviewId");
    const agentType = c.req.param("agentType") as ReviewAgentType;

    if (!AGENT_TYPES.includes(agentType)) {
      return c.json({ error: `Invalid agent type: ${agentType}` }, 400);
    }

    const review = await loadReview(slug, reviewId);
    if (!review) return c.json({ error: "Review not found" }, 404);

    const agentResult = review.agent_reviews?.find(
      (r) => r.agent_type === agentType
    );

    if (!agentResult) {
      return c.json(
        { error: `Agent '${agentType}' has not been executed for this review` },
        404
      );
    }

    // Filter out dismissed findings
    const filteredResult: AgentReviewResult = {
      ...agentResult,
      findings: agentResult.findings.filter((f) => !f.dismissed),
    };

    return c.json(filteredResult);
  }
);

// PATCH /hub/projects/:slug/reviews/:reviewId/findings/:findingId
agentReview.patch(
  "/hub/projects/:slug/reviews/:reviewId/findings/:findingId",
  async (c) => {
    const slug = c.req.param("slug");
    const reviewId = c.req.param("reviewId");
    const findingId = c.req.param("findingId");

    const review = await loadReview(slug, reviewId);
    if (!review) return c.json({ error: "Review not found" }, 404);

    if (!review.agent_reviews || review.agent_reviews.length === 0) {
      return c.json({ error: "No agent reviews found" }, 404);
    }

    let body: { dismissed?: boolean } = {};
    try {
      body = await c.req.json();
    } catch {
      // default to dismissed = true
    }
    const dismissed = body.dismissed !== undefined ? body.dismissed : true;

    // Find the finding across all agent reviews
    let found = false;
    for (const agentResult of review.agent_reviews) {
      const finding = agentResult.findings.find((f) => f.id === findingId);
      if (finding) {
        finding.dismissed = dismissed;
        found = true;
        break;
      }
    }

    if (!found) {
      return c.json({ error: "Finding not found" }, 404);
    }

    review.updated_at = new Date().toISOString();
    await saveReview(slug, review);

    return c.json({ id: findingId, dismissed });
  }
);

export { agentReview };

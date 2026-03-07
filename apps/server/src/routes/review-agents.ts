import { Hono } from "hono";
import path from "node:path";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";

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

// --- Defaults ---

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

// --- Helpers ---

function configPath(slug: string): string {
  return path.join(
    config.projectsDir,
    slug,
    "review-agents",
    "config.json"
  );
}

async function loadConfig(slug: string): Promise<ReviewAgentsConfig> {
  try {
    const data = await readJSON<ReviewAgentsConfig>(configPath(slug));
    // Merge with defaults to ensure all 4 agents exist
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

async function saveConfig(
  slug: string,
  cfg: ReviewAgentsConfig
): Promise<void> {
  const filePath = configPath(slug);
  await ensureDir(path.dirname(filePath));
  await writeJSON(filePath, cfg);
}

// --- Routes ---

const reviewAgents = new Hono();

// GET /hub/projects/:slug/review-agents
reviewAgents.get("/hub/projects/:slug/review-agents", async (c) => {
  const slug = c.req.param("slug");
  const cfg = await loadConfig(slug);
  const agents = AGENT_TYPES.map((t) => cfg[t]);
  return c.json({ agents });
});

// PATCH /hub/projects/:slug/review-agents/:type
reviewAgents.patch("/hub/projects/:slug/review-agents/:type", async (c) => {
  const slug = c.req.param("slug");
  const agentType = c.req.param("type") as string;

  if (!AGENT_TYPES.includes(agentType as ReviewAgentType)) {
    return c.json(
      { error: `Invalid agent type: ${agentType}. Valid types: ${AGENT_TYPES.join(", ")}` },
      400
    );
  }

  const body = await c.req.json<{
    enabled?: boolean;
    system_prompt?: string;
  }>();

  const cfg = await loadConfig(slug);
  const agent = cfg[agentType as ReviewAgentType];

  if (body.enabled !== undefined) {
    agent.enabled = body.enabled;
  }
  if (body.system_prompt !== undefined) {
    agent.system_prompt = body.system_prompt;
  }

  cfg[agentType as ReviewAgentType] = agent;
  await saveConfig(slug, cfg);

  return c.json({ agent });
});

export { reviewAgents };

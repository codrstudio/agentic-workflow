import { Hono } from "hono";
import path from "node:path";
import { readdir, readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { readJSON, writeJSON, ensureDir } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";
import { spawnClaudeStream } from "../lib/claude-client.js";
import {
  DocArtifactSchema,
  GenerateDocBody,
  type DocArtifact,
  type DocType,
  type DocSourceRef,
} from "../schemas/doc.js";
import { type Project } from "../schemas/project.js";
import { type Source } from "../schemas/source.js";
import { type Artifact } from "../schemas/artifact.js";

const docs = new Hono();

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

function docsDir(slug: string): string {
  return path.join(projectDir(slug), "docs");
}

function docPath(slug: string, id: string): string {
  return path.join(docsDir(slug), `${id}.json`);
}

async function loadDoc(
  slug: string,
  id: string
): Promise<DocArtifact | null> {
  try {
    return await readJSON<DocArtifact>(docPath(slug, id));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return null;
    throw err;
  }
}

async function loadAllDocs(slug: string): Promise<DocArtifact[]> {
  const dir = docsDir(slug);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") return [];
    throw err;
  }

  const jsonFiles = entries.filter(
    (f) => f.endsWith(".json") && !f.startsWith(".")
  );

  const results: DocArtifact[] = [];
  for (const file of jsonFiles) {
    try {
      const doc = await readJSON<DocArtifact>(path.join(dir, file));
      results.push(doc);
    } catch {
      // skip invalid files
    }
  }
  return results;
}

// --- Source collection ---

async function loadSources(slug: string): Promise<Source[]> {
  try {
    return await readJSON<Source[]>(
      path.join(projectDir(slug), "sources", "sources.json")
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function loadSourceContent(
  slug: string,
  source: Source
): Promise<string | undefined> {
  if (source.content !== undefined) return source.content;
  if (source.file_path) {
    const fullPath = path.join(
      projectDir(slug),
      "sources",
      source.file_path
    );
    try {
      return await readFile(fullPath, "utf-8");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function loadArtifacts(slug: string): Promise<Artifact[]> {
  try {
    return await readJSON<Artifact[]>(
      path.join(projectDir(slug), "artifacts", "artifacts.json")
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found")) return [];
    throw err;
  }
}

async function loadArtifactContent(
  slug: string,
  artifact: Artifact
): Promise<string | undefined> {
  if (artifact.content !== undefined) return artifact.content;
  if (artifact.file_path) {
    const fullPath = path.join(
      projectDir(slug),
      "artifacts",
      artifact.file_path
    );
    try {
      return await readFile(fullPath, "utf-8");
    } catch {
      return undefined;
    }
  }
  return undefined;
}

interface CollectedSource {
  ref: DocSourceRef;
  content: string;
}

async function collectSources(
  slug: string,
  sourceIds: string[]
): Promise<CollectedSource[]> {
  const collected: CollectedSource[] = [];

  const sources = await loadSources(slug);
  const artifacts = await loadArtifacts(slug);

  for (const id of sourceIds) {
    // Try sources first
    const source = sources.find((s) => s.id === id);
    if (source) {
      const content = await loadSourceContent(slug, source);
      if (content) {
        collected.push({
          ref: {
            type: "source",
            id: source.id,
            name: source.name,
          },
          content,
        });
      }
      continue;
    }

    // Try artifacts
    const artifact = artifacts.find((a) => a.id === id);
    if (artifact) {
      const content = await loadArtifactContent(slug, artifact);
      if (content) {
        const refType = artifact.type === "code" ? "code_file" as const : "source" as const;
        collected.push({
          ref: {
            type: refType,
            id: artifact.id,
            name: artifact.name,
          },
          content,
        });
      }
    }
  }

  return collected;
}

// --- Prompt composition by doc_type ---

const DOC_TYPE_PROMPTS: Record<DocType, (projectName: string) => string> = {
  api_reference: (projectName) =>
    `Gere documentacao de API Reference para o projeto ${projectName}.
Baseie-se nas seguintes specs e PRPs:

{sources_content}

Formato: markdown com secoes por endpoint.
Para cada endpoint: metodo, rota, descricao, parametros (tabela), request body (JSON schema), response (JSON schema), exemplos, codigos de erro.
Agrupe por dominio/recurso.`,

  component_guide: (projectName) =>
    `Gere um guia de componentes UI para o projeto ${projectName}.
Baseie-se nas seguintes specs:

{sources_content}

Formato: markdown com secao por componente.
Para cada componente: nome, descricao, props (tabela), estados, variantes, exemplo de uso, notas de acessibilidade.`,

  architecture: (projectName) =>
    `Gere documentacao de arquitetura para o projeto ${projectName}.
Baseie-se em:

{sources_content}

Formato: markdown com secoes: Visao Geral, Stack Tecnologica, Camadas (Data/API/UI), Fluxos Principais, Decisoes Arquiteturais, Diagramas (mermaid).`,

  user_guide: (projectName) =>
    `Gere um guia do usuario para o projeto ${projectName}.
Baseie-se em:

{sources_content}

Formato: markdown com secoes: Introducao, Primeiros Passos, Funcionalidades Principais, FAQ, Dicas e Truques.
Linguagem acessivel, com exemplos praticos e screenshots placeholders.`,

  changelog: (projectName) =>
    `Gere um changelog para o projeto ${projectName}.
Baseie-se em:

{sources_content}

Formato: markdown seguindo Keep a Changelog (keepachangelog.com).
Agrupe por versao, com secoes: Added, Changed, Deprecated, Removed, Fixed, Security.`,

  runbook: (projectName) =>
    `Gere um runbook operacional para o projeto ${projectName}.
Baseie-se em:

{sources_content}

Formato: markdown com secoes: Pre-requisitos, Setup do Ambiente, Deploy, Monitoramento, Troubleshooting, Rollback, Contatos.
Inclua comandos copiáveis e checklists.`,

  custom: (_projectName) =>
    `{sources_content}`,
};

function composePrompt(
  docType: DocType,
  projectName: string,
  sourcesContent: string,
  customPrompt?: string
): string {
  if (customPrompt) {
    // Custom prompt replaces the template, but still injects sources
    return customPrompt.includes("{sources_content}")
      ? customPrompt.replace("{sources_content}", sourcesContent)
      : customPrompt + "\n\n---\n\nSources:\n\n" + sourcesContent;
  }

  const template = DOC_TYPE_PROMPTS[docType](projectName);
  return template.replace("{sources_content}", sourcesContent);
}

function formatSourcesContent(collected: CollectedSource[]): string {
  return collected
    .map(
      (s) =>
        `### ${s.ref.name} (${s.ref.type})\n\n${s.content}`
    )
    .join("\n\n---\n\n");
}

// --- Claude generation ---

function generateWithClaude(
  prompt: string
): Promise<{ content: string; tokensEstimate: number }> {
  return new Promise((resolve, reject) => {
    let fullText = "";

    spawnClaudeStream(
      {
        prompt,
        systemPrompt:
          "You are a technical documentation writer. Generate clear, well-structured markdown documentation based on the provided sources. Output ONLY the documentation content in markdown format, no meta-commentary.",
        maxTurns: 1,
        allowedTools: [],
      },
      {
        onDelta: (text) => {
          fullText += text;
        },
        onComplete: (text) => {
          const content = text || fullText;
          resolve({
            content,
            tokensEstimate: Math.ceil(content.length / 4),
          });
        },
        onError: (error) => {
          reject(new Error(error));
        },
      }
    );
  });
}

// POST /hub/projects/:slug/docs/generate — generate doc via AI
docs.post("/hub/projects/:slug/docs/generate", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = GenerateDocBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { doc_type, title, source_ids, custom_prompt } = parsed.data;

  // Collect sources
  const collected = await collectSources(slug, source_ids);
  if (collected.length === 0) {
    return c.json(
      { error: "No sources found for the provided source_ids" },
      400
    );
  }

  // Compose prompt
  const sourcesContent = formatSourcesContent(collected);
  const prompt = composePrompt(
    doc_type,
    project.name,
    sourcesContent,
    custom_prompt
  );

  // Generate via Claude
  let generatedContent: string;
  let tokensUsed: number;
  try {
    const result = await generateWithClaude(prompt);
    generatedContent = result.content;
    tokensUsed = result.tokensEstimate;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Generation failed: ${msg}` }, 500);
  }

  // Persist as DocArtifact v1
  const now = new Date().toISOString();
  const id = randomUUID();

  const doc: DocArtifact = {
    id,
    project_id: slug,
    title,
    doc_type,
    status: "draft",
    content: generatedContent,
    generated_from: collected.map((s) => s.ref),
    generation_prompt: prompt,
    ai_model: "claude",
    tokens_used: tokensUsed,
    version: 1,
    created_at: now,
    updated_at: now,
  };

  await ensureDir(docsDir(slug));
  await writeJSON(docPath(slug, id), doc);

  return c.json(doc, 201);
});

// GET /hub/projects/:slug/docs — list docs with filters
docs.get("/hub/projects/:slug/docs", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  let all = await loadAllDocs(slug);

  // Filter by doc_type
  const docType = c.req.query("doc_type");
  if (docType) {
    all = all.filter((d) => d.doc_type === docType);
  }

  // Filter by status
  const status = c.req.query("status");
  if (status) {
    all = all.filter((d) => d.status === status);
  }

  // Search by title
  const search = c.req.query("search");
  if (search) {
    const lower = search.toLowerCase();
    all = all.filter((d) => d.title.toLowerCase().includes(lower));
  }

  // Limit
  const limitStr = c.req.query("limit");
  const limit = limitStr ? parseInt(limitStr, 10) : 50;
  all = all.slice(0, limit);

  return c.json(all);
});

// GET /hub/projects/:slug/docs/:id — get single doc
docs.get("/hub/projects/:slug/docs/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const doc = await loadDoc(slug, id);
  if (!doc) return c.json({ error: "Doc not found" }, 404);

  return c.json(doc);
});

export { docs };

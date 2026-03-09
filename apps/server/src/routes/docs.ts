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
  PatchDocBody,
  VerifyDocBody,
  CreateCommentBody,
  type DocArtifact,
  type DocType,
  type DocSourceRef,
  type DocVerificationComment,
  type DocVersion,
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

function docVersionsDir(slug: string, docId: string): string {
  return path.join(docsDir(slug), "versions", docId);
}

function docVersionPath(slug: string, docId: string, version: number): string {
  return path.join(docVersionsDir(slug, docId), `v${version}.json`);
}

function docCommentsDir(slug: string, docId: string): string {
  return path.join(docsDir(slug), "comments", docId);
}

function docCommentPath(slug: string, docId: string, commentId: string): string {
  return path.join(docCommentsDir(slug, docId), `${commentId}.json`);
}

async function saveDocVersion(slug: string, doc: DocArtifact): Promise<void> {
  const version: DocVersion = {
    doc_id: doc.id,
    version: doc.version,
    content: doc.content,
    title: doc.title,
    status: doc.status,
    created_at: doc.updated_at,
  };
  await ensureDir(docVersionsDir(slug, doc.id));
  await writeJSON(docVersionPath(slug, doc.id, doc.version), version);
}

async function loadDocComments(
  slug: string,
  docId: string
): Promise<DocVerificationComment[]> {
  const dir = docCommentsDir(slug, docId);
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

  const results: DocVerificationComment[] = [];
  for (const file of jsonFiles) {
    try {
      const comment = await readJSON<DocVerificationComment>(
        path.join(dir, file)
      );
      results.push(comment);
    } catch {
      // skip invalid
    }
  }
  return results.sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
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

  // Exclude soft-deleted docs
  all = all.filter(
    (d) => !(d as DocArtifact & { is_deleted?: boolean }).is_deleted
  );

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

// PATCH /hub/projects/:slug/docs/:id — update doc, increment version on content change
docs.patch("/hub/projects/:slug/docs/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const doc = await loadDoc(slug, id);
  if (!doc) return c.json({ error: "Doc not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = PatchDocBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const updates = parsed.data;
  const now = new Date().toISOString();

  // If content is changing, save current version snapshot and increment
  const contentChanged =
    updates.content !== undefined && updates.content !== doc.content;

  if (contentChanged) {
    // Save current version before overwriting
    await saveDocVersion(slug, doc);
  }

  // Apply updates
  if (updates.title !== undefined) doc.title = updates.title;
  if (updates.doc_type !== undefined) doc.doc_type = updates.doc_type;
  if (updates.status !== undefined) doc.status = updates.status;
  if (updates.content !== undefined) doc.content = updates.content;

  if (contentChanged) {
    doc.version += 1;
    // Reset verification on content change
    doc.verified_by = undefined;
    doc.verified_at = undefined;
    doc.verification_notes = undefined;
    if (doc.status === "verified") {
      doc.status = "draft";
    }
  }

  doc.updated_at = now;
  await writeJSON(docPath(slug, id), doc);

  return c.json(doc);
});

// DELETE /hub/projects/:slug/docs/:id — soft-delete doc
docs.delete("/hub/projects/:slug/docs/:id", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const doc = await loadDoc(slug, id);
  if (!doc) return c.json({ error: "Doc not found" }, 404);

  // Soft-delete by adding is_deleted flag
  (doc as DocArtifact & { is_deleted?: boolean }).is_deleted = true;
  doc.updated_at = new Date().toISOString();
  await writeJSON(docPath(slug, id), doc);

  return c.json({ message: "Doc deleted", id });
});

// POST /hub/projects/:slug/docs/:id/verify — approve or reject doc
docs.post("/hub/projects/:slug/docs/:id/verify", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const doc = await loadDoc(slug, id);
  if (!doc) return c.json({ error: "Doc not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = VerifyDocBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { action, notes, verified_by } = parsed.data;
  const now = new Date().toISOString();

  doc.status = action === "approve" ? "verified" : "rejected";
  doc.verified_by = verified_by;
  doc.verified_at = now;
  if (notes) doc.verification_notes = notes;
  doc.updated_at = now;

  await writeJSON(docPath(slug, id), doc);

  return c.json(doc);
});

// POST /hub/projects/:slug/docs/:id/regenerate — regenerate doc from sources
docs.post("/hub/projects/:slug/docs/:id/regenerate", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const doc = await loadDoc(slug, id);
  if (!doc) return c.json({ error: "Doc not found" }, 404);

  // Re-collect sources from generated_from refs
  const sourceIds = doc.generated_from.map((ref) => ref.id);
  if (sourceIds.length === 0) {
    return c.json({ error: "No sources to regenerate from" }, 400);
  }

  const collected = await collectSources(slug, sourceIds);
  if (collected.length === 0) {
    return c.json({ error: "No sources found for regeneration" }, 400);
  }

  // Compose prompt and regenerate
  const sourcesContent = formatSourcesContent(collected);
  const prompt = composePrompt(
    doc.doc_type,
    project.name,
    sourcesContent,
    doc.generation_prompt?.includes("{sources_content}")
      ? doc.generation_prompt
      : undefined
  );

  let generatedContent: string;
  let tokensUsed: number;
  try {
    const result = await generateWithClaude(prompt);
    generatedContent = result.content;
    tokensUsed = result.tokensEstimate;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Regeneration failed: ${msg}` }, 500);
  }

  // Save current version before overwriting
  await saveDocVersion(slug, doc);

  const now = new Date().toISOString();
  doc.content = generatedContent;
  doc.version += 1;
  doc.status = "draft";
  doc.tokens_used = tokensUsed;
  doc.generated_from = collected.map((s) => s.ref);
  doc.generation_prompt = prompt;
  doc.verified_by = undefined;
  doc.verified_at = undefined;
  doc.verification_notes = undefined;
  doc.updated_at = now;

  await writeJSON(docPath(slug, id), doc);

  return c.json(doc);
});

// GET /hub/projects/:slug/docs/:id/comments — list comments
docs.get("/hub/projects/:slug/docs/:id/comments", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const doc = await loadDoc(slug, id);
  if (!doc) return c.json({ error: "Doc not found" }, 404);

  const comments = await loadDocComments(slug, id);
  return c.json(comments);
});

// POST /hub/projects/:slug/docs/:id/comments — create comment
docs.post("/hub/projects/:slug/docs/:id/comments", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const id = c.req.param("id");
  const doc = await loadDoc(slug, id);
  if (!doc) return c.json({ error: "Doc not found" }, 404);

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = CreateCommentBody.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400
    );
  }

  const { author, content, line_range, action } = parsed.data;
  const now = new Date().toISOString();
  const commentId = randomUUID();

  const comment: DocVerificationComment = {
    id: commentId,
    doc_id: id,
    author,
    content,
    line_range,
    action,
    created_at: now,
  };

  await ensureDir(docCommentsDir(slug, id));
  await writeJSON(docCommentPath(slug, id, commentId), comment);

  return c.json(comment, 201);
});

// POST /hub/projects/:slug/docs/detect-outdated — detect docs with newer sources
docs.post("/hub/projects/:slug/docs/detect-outdated", async (c) => {
  const slug = c.req.param("slug");
  const project = await loadProject(slug);
  if (!project) return c.json({ error: "Project not found" }, 404);

  const allDocs = await loadAllDocs(slug);
  const sources = await loadSources(slug);
  const artifactsList = await loadArtifacts(slug);

  // Build a map of source/artifact id -> updated_at
  const sourceUpdatedMap = new Map<string, string>();
  for (const s of sources) {
    if (s.updated_at) sourceUpdatedMap.set(s.id, s.updated_at);
    else if (s.created_at) sourceUpdatedMap.set(s.id, s.created_at);
  }
  for (const a of artifactsList) {
    if (a.updated_at) sourceUpdatedMap.set(a.id, a.updated_at);
    else if (a.created_at) sourceUpdatedMap.set(a.id, a.created_at);
  }

  const outdatedDocs: Array<{
    doc_id: string;
    title: string;
    doc_updated_at: string;
    outdated_sources: Array<{ id: string; name: string; source_updated_at: string }>;
  }> = [];

  for (const doc of allDocs) {
    // Skip deleted docs
    if ((doc as DocArtifact & { is_deleted?: boolean }).is_deleted) continue;

    const outdatedSources: Array<{
      id: string;
      name: string;
      source_updated_at: string;
    }> = [];

    for (const ref of doc.generated_from) {
      const sourceUpdated = sourceUpdatedMap.get(ref.id);
      if (sourceUpdated && sourceUpdated > doc.updated_at) {
        outdatedSources.push({
          id: ref.id,
          name: ref.name,
          source_updated_at: sourceUpdated,
        });
      }
    }

    if (outdatedSources.length > 0) {
      outdatedDocs.push({
        doc_id: doc.id,
        title: doc.title,
        doc_updated_at: doc.updated_at,
        outdated_sources: outdatedSources,
      });
    }
  }

  return c.json({ outdated_docs: outdatedDocs, count: outdatedDocs.length });
});

export { docs };

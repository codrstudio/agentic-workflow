import path from "node:path";
import { readFile } from "node:fs/promises";
import { config } from "./config.js";
import type { Source } from "../schemas/source.js";

// Category priority order: business first, general last
const CATEGORY_ORDER: Source["category"][] = [
  "business",
  "backend",
  "frontend",
  "config",
  "reference",
  "general",
];

export interface ProjectContext {
  name: string;
  description?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ComposePromptInput {
  project: ProjectContext;
  sources: Source[];
  history: ChatMessage[];
  message: string;
  maxHistoryMessages?: number;
  /** Pre-formatted MCP tools section to append to system prompt */
  mcpToolsSection?: string;
}

export interface ComposedPrompt {
  system: string;
  messages: ChatMessage[];
}

const DEFAULT_MAX_HISTORY = 50;

const SYSTEM_INSTRUCTIONS = `You are a helpful AI assistant for the project "{project_name}". You help the user think through ideas, analyze information, and produce useful outputs based on the project context and sources provided.

Be concise, accurate, and helpful. When referencing information from sources, cite the source name. Format your responses using markdown when appropriate.`;

function buildSystemPrompt(project: ProjectContext): string {
  return SYSTEM_INSTRUCTIONS.replace("{project_name}", project.name);
}

function buildProjectContext(project: ProjectContext): string {
  const parts = [`## Project: ${project.name}`];
  if (project.description) {
    parts.push(project.description);
  }
  return parts.join("\n");
}

function buildSourceBlock(source: Source, content: string): string {
  return [
    `--- Source: ${source.name} (type: ${source.type}) ---`,
    content,
    `--- End Source ---`,
  ].join("\n");
}

async function loadSourceContent(
  projectSlug: string,
  source: Source
): Promise<string | null> {
  if (source.content !== undefined && source.content !== null) {
    return source.content;
  }
  if (source.file_path) {
    const fullPath = path.join(
      config.projectsDir,
      projectSlug,
      "sources",
      source.file_path
    );
    try {
      return await readFile(fullPath, "utf-8");
    } catch {
      return null;
    }
  }
  return null;
}

export async function composePrompt(
  input: ComposePromptInput,
  projectSlug: string
): Promise<ComposedPrompt> {
  const { project, sources, history, message, maxHistoryMessages, mcpToolsSection } = input;
  const maxHistory = maxHistoryMessages ?? DEFAULT_MAX_HISTORY;

  // 1. System prompt with project context
  const systemParts: string[] = [buildSystemPrompt(project)];

  // 2. Project context
  systemParts.push(buildProjectContext(project));

  // 3. Sources context — ordered by category (business first) with delimiters
  if (sources.length > 0) {
    // Group sources by category
    const byCategory = new Map<string, { source: Source; content: string }[]>();
    for (const source of sources) {
      const content = await loadSourceContent(projectSlug, source);
      if (!content) continue;
      const cat = source.category ?? "general";
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push({ source, content });
    }

    // Emit in category priority order with [Context: {Category}] delimiters
    const categoryBlocks: string[] = [];
    for (const cat of CATEGORY_ORDER) {
      const entries = byCategory.get(cat);
      if (!entries || entries.length === 0) continue;
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const blocks = entries.map((e) => buildSourceBlock(e.source, e.content));
      categoryBlocks.push(
        `[Context: ${label}]\n\n${blocks.join("\n\n")}\n\n[/Context: ${label}]`
      );
    }

    if (categoryBlocks.length > 0) {
      systemParts.push("## Sources\n\n" + categoryBlocks.join("\n\n"));
    }
  }

  // 4. MCP Tools section (when MCP servers connected)
  if (mcpToolsSection) {
    systemParts.push(mcpToolsSection);
  }

  const system = systemParts.join("\n\n");

  // 4. History (last N messages)
  const trimmedHistory = history.slice(-maxHistory);

  // 5. Current user message
  const messages: ChatMessage[] = [
    ...trimmedHistory,
    { role: "user", content: message },
  ];

  return { system, messages };
}

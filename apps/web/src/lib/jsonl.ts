/**
 * Shared JSONL parsing utilities for Claude CLI spawn.jsonl files.
 * Used by step-detail (full log) and potentially monitor (activity feed).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLineType = "system" | "assistant" | "tool_use" | "tool_result" | "user"

export interface LogLine {
  index: number
  type: LogLineType
  raw: unknown
}

export type ContentBlock =
  | { kind: "thinking"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool_call"; name: string; summary: string }
  | { kind: "tool_result"; name: string; success: boolean; snippet: string }
  | { kind: "result"; is_error: boolean; cost_usd: number; duration_ms: number; num_turns: number; input_tokens: number; output_tokens: number; cache_read_tokens: number; result_text: string }
  | { kind: "rate_limit"; utilization: number; status: string }
  | { kind: "raw"; text: string }

export interface ParsedLine {
  index: number
  type: LogLineType
  blocks: ContentBlock[]
  searchText: string
}

// ─── Tool Input Summarizer ──────────────────────────────────────────────────

export function summarizeToolInput(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "Read": return String(input["file_path"] ?? "")
    case "Write": return String(input["file_path"] ?? "")
    case "Edit": return String(input["file_path"] ?? "")
    case "Glob": return String(input["pattern"] ?? "")
    case "Grep": return String(input["pattern"] ?? "")
    case "Bash": {
      const cmd = String(input["command"] ?? "")
      return cmd.length > 120 ? cmd.slice(0, 117) + "…" : cmd
    }
    case "TodoWrite":
    case "TaskCreate": return String(input["subject"] ?? input["description"] ?? "").slice(0, 80)
    case "Agent": return String(input["description"] ?? input["prompt"] ?? "").slice(0, 80)
    default: {
      const keys = Object.keys(input)
      if (keys.length === 0) return ""
      const first = input[keys[0]!]
      return typeof first === "string" ? first.slice(0, 80) : ""
    }
  }
}

// ─── Tool Result Snippet ────────────────────────────────────────────────────

function extractToolResultSnippet(block: Record<string, unknown>): string {
  const inner = block["content"]
  if (typeof inner === "string") return inner.slice(0, 200)
  if (Array.isArray(inner)) {
    for (const part of inner as Array<Record<string, unknown>>) {
      if (part["type"] === "text" && typeof part["text"] === "string") {
        return (part["text"] as string).slice(0, 200)
      }
    }
  }
  return ""
}

// ─── Line Parser ────────────────────────────────────────────────────────────

function parseSingleLine(
  line: LogLine,
  toolNameById: Map<string, string>,
): ContentBlock[] {
  const raw = line.raw as Record<string, unknown>

  // result event (final summary with cost/tokens)
  if (raw["type"] === "result") {
    const usage = raw["usage"] as Record<string, unknown> | undefined
    return [{
      kind: "result",
      is_error: raw["is_error"] === true,
      cost_usd: (raw["total_cost_usd"] as number) ?? 0,
      duration_ms: (raw["duration_ms"] as number) ?? 0,
      num_turns: (raw["num_turns"] as number) ?? 0,
      input_tokens: (usage?.["input_tokens"] as number) ?? 0,
      output_tokens: (usage?.["output_tokens"] as number) ?? 0,
      cache_read_tokens: (usage?.["cache_read_input_tokens"] as number) ?? 0,
      result_text: typeof raw["result"] === "string" ? (raw["result"] as string).slice(0, 500) : "",
    }]
  }

  // rate_limit_event
  if (raw["type"] === "rate_limit_event") {
    const info = raw["rate_limit_info"] as Record<string, unknown> | undefined
    if (info) {
      return [{
        kind: "rate_limit",
        utilization: (info["utilization"] as number) ?? 0,
        status: (info["status"] as string) ?? "unknown",
      }]
    }
    return [{ kind: "raw", text: JSON.stringify(raw).slice(0, 200) }]
  }

  // system init
  if (raw["type"] === "system") {
    const subtype = raw["subtype"] as string | undefined
    if (subtype === "init") return [{ kind: "text", text: "[system init]" }]
    return [{ kind: "raw", text: JSON.stringify(raw).slice(0, 200) }]
  }

  // assistant or tool_use messages
  if (raw["type"] === "assistant") {
    const msg = raw["message"] as Record<string, unknown> | undefined
    const content = Array.isArray(msg?.["content"]) ? (msg!["content"] as Array<Record<string, unknown>>) : []
    const blocks: ContentBlock[] = []

    for (const c of content) {
      if (c["type"] === "thinking" && typeof c["thinking"] === "string") {
        const text = (c["thinking"] as string).trim()
        if (text) blocks.push({ kind: "thinking", text: text.length > 300 ? text.slice(0, 297) + "…" : text })
      } else if (c["type"] === "text" && typeof c["text"] === "string") {
        const text = (c["text"] as string).trim()
        if (text) blocks.push({ kind: "text", text: text.length > 500 ? text.slice(0, 497) + "…" : text })
      } else if (c["type"] === "tool_use" && typeof c["name"] === "string") {
        const name = c["name"] as string
        const input = (c["input"] as Record<string, unknown>) ?? {}
        const id = c["id"] as string | undefined
        if (id) toolNameById.set(id, name)
        blocks.push({ kind: "tool_call", name, summary: summarizeToolInput(name, input) })
      }
    }

    return blocks.length > 0 ? blocks : [{ kind: "raw", text: JSON.stringify(raw).slice(0, 200) }]
  }

  // user / tool_result messages
  if (raw["type"] === "user") {
    const msg = raw["message"] as Record<string, unknown> | undefined
    const content = Array.isArray(msg?.["content"]) ? (msg!["content"] as Array<Record<string, unknown>>) : []
    const blocks: ContentBlock[] = []

    for (const c of content) {
      if (c["type"] === "tool_result") {
        const toolUseId = c["tool_use_id"] as string | undefined
        const toolName = (toolUseId && toolNameById.get(toolUseId)) ?? "?"
        const isError = c["is_error"] === true
        const snippet = extractToolResultSnippet(c)
        blocks.push({ kind: "tool_result", name: toolName, success: !isError, snippet })
      } else if (c["type"] === "text" && typeof c["text"] === "string") {
        blocks.push({ kind: "text", text: (c["text"] as string).trim().slice(0, 500) })
      }
    }

    return blocks.length > 0 ? blocks : [{ kind: "raw", text: JSON.stringify(raw).slice(0, 200) }]
  }

  return [{ kind: "raw", text: JSON.stringify(raw).slice(0, 200) }]
}

// ─── Batch Parser (correlates tool IDs across lines) ────────────────────────

function blockToText(block: ContentBlock): string {
  switch (block.kind) {
    case "thinking": return block.text
    case "text": return block.text
    case "tool_call": return `${block.name} ${block.summary}`
    case "tool_result": return `${block.name} ${block.success ? "ok" : "erro"} ${block.snippet}`
    case "result": return `${block.is_error ? "Falhou" : "Concluído"} $${block.cost_usd.toFixed(2)} ${block.num_turns} turns`
    case "rate_limit": return `rate limit ${Math.round(block.utilization * 100)}% ${block.status}`
    case "raw": return block.text
  }
}

/**
 * Parse all LogLines into ParsedLines with semantic content blocks.
 * Handles tool_use_id → tool name correlation across lines.
 */
export function parseAllLines(lines: LogLine[]): ParsedLine[] {
  const toolNameById = new Map<string, string>()
  return lines.map((line) => {
    const blocks = parseSingleLine(line, toolNameById)
    const searchText = blocks.map(blockToText).join(" ").toLowerCase()
    return { index: line.index, type: line.type, blocks, searchText }
  })
}

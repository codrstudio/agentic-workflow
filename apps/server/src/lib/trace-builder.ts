/**
 * trace-builder.ts
 *
 * Reads spawn.json, loop.json, and spawn.jsonl from a workspace wave directory
 * and constructs a PipelineTrace with hierarchical TraceSpans.
 *
 * Hierarchy: wave → step → feature_attempt → agent_call
 */

import path from "node:path";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { readJSON, listDirs, writeJSON, ensureDir } from "./fs-utils.js";
import type {
  PipelineTrace,
  TraceSpan,
  ToolCall,
  TraceSpanStatus,
  TraceStatus,
} from "../schemas/pipeline-trace.js";

// ---- Raw formats from filesystem ----

interface SpawnMeta {
  task?: string;
  agent?: string;
  wave?: number;
  step?: number;
  feature?: string;
  attempt?: number;
  parent_pid?: number;
  pid?: number;
  started_at?: string;
  finished_at?: string;
  exit_code?: number | null;
  timed_out?: boolean;
}

interface LoopMeta {
  status?: string;
  pid?: number;
  iteration?: number;
  total?: number;
  done?: number;
  remaining?: number;
  features_done?: number;
  started_at?: string;
  updated_at?: string;
  feature_id?: string;
  current_feature?: string;
  exit_reason?: string;
}

// ---- JSONL message types ----

interface AssistantUsage {
  input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens?: number;
}

interface AssistantMessage {
  model?: string;
  content?: Array<{
    type: string;
    text?: string;
    name?: string; // tool_use name
    id?: string; // tool_use id
  }>;
  usage?: AssistantUsage;
}

interface JsonlLine {
  type: string;
  subtype?: string;
  message?: AssistantMessage | { role?: string; content?: unknown };
  is_error?: boolean;
  duration_ms?: number;
  result?: string;
  parent_tool_use_id?: string | null;
  tool_use_result?: { stdout?: string; stderr?: string; is_error?: boolean };
}

// ---- Helpers ----

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function safeReadJSON<T>(filePath: string): Promise<T | null> {
  try {
    return await readJSON<T>(filePath);
  } catch {
    return null;
  }
}

async function readJsonlLines(filePath: string): Promise<JsonlLine[]> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return raw
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as JsonlLine;
        } catch {
          return null;
        }
      })
      .filter((l): l is JsonlLine => l !== null);
  } catch {
    return [];
  }
}

function spawnStatusToSpanStatus(spawn: SpawnMeta | null): TraceSpanStatus {
  if (!spawn) return "running";
  if (spawn.finished_at != null) {
    return spawn.exit_code === 0 ? "completed" : "failed";
  }
  return spawn.started_at ? "running" : "running";
}

function computeDuration(started: string | undefined, ended: string | undefined | null): number | null {
  if (!started || !ended) return null;
  const ms = new Date(ended).getTime() - new Date(started).getTime();
  return isNaN(ms) ? null : ms;
}

// Rough token cost in USD based on model
function estimateCost(model: string | undefined, inputTokens: number, outputTokens: number): number | null {
  if (!model) return null;
  // Pricing per 1M tokens (approximate)
  let inputRate = 3.0; // default sonnet
  let outputRate = 15.0;
  const m = model.toLowerCase();
  if (m.includes("haiku")) {
    inputRate = 0.25;
    outputRate = 1.25;
  } else if (m.includes("opus")) {
    inputRate = 15.0;
    outputRate = 75.0;
  } else if (m.includes("sonnet")) {
    inputRate = 3.0;
    outputRate = 15.0;
  }
  const cost = (inputTokens / 1_000_000) * inputRate + (outputTokens / 1_000_000) * outputRate;
  return Math.round(cost * 1_000_000) / 1_000_000; // round to 6 decimal places
}

/**
 * Parse a spawn.jsonl file to extract tool calls, I/O summaries, and token counts.
 */
async function parseSpawnJsonl(jsonlPath: string): Promise<{
  tool_calls: ToolCall[];
  input_summary: string | null;
  output_summary: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  cost_usd: number | null;
  model: string | null;
}> {
  const lines = await readJsonlLines(jsonlPath);

  let inputSummary: string | null = null;
  let outputSummary: string | null = null;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let hasUsage = false;
  let model: string | null = null;
  const toolCalls: ToolCall[] = [];

  // Track tool_use timestamps: tool_use id -> rough timestamp
  // We use the position in file as a proxy for timestamp
  const baseTime = (() => {
    for (const line of lines) {
      const msg = line.message as AssistantMessage | undefined;
      if (line.type === "assistant" && msg?.content) {
        // No direct timestamp in messages, use system init time if available
      }
    }
    return null;
  })();

  // Get started_at from system init line or first assistant line
  let sessionStart: string | null = null;
  let sessionEnd: string | null = null;
  for (const line of lines) {
    if (line.type === "system" && (line as unknown as { started_at?: string }).started_at) {
      sessionStart = (line as unknown as { started_at: string }).started_at;
    }
    if (line.type === "result") {
      const r = line as unknown as { duration_ms?: number; result?: string };
      if (r.result) {
        outputSummary = r.result.substring(0, 400);
      }
    }
  }
  void baseTime;

  // Process assistant messages
  for (const line of lines) {
    if (line.type === "assistant") {
      const msg = line.message as AssistantMessage;
      if (!msg) continue;

      // Capture model
      if (msg.model && !model) {
        model = msg.model;
      }

      // Accumulate token usage
      if (msg.usage) {
        hasUsage = true;
        totalInputTokens +=
          (msg.usage.input_tokens ?? 0) +
          (msg.usage.cache_creation_input_tokens ?? 0) +
          (msg.usage.cache_read_input_tokens ?? 0);
        totalOutputTokens += msg.usage.output_tokens ?? 0;
      }

      // Extract tool calls
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "tool_use" && block.name) {
            // Use sessionStart as base; we don't have per-message timestamps
            const ts = sessionStart ?? new Date().toISOString();
            toolCalls.push({
              tool: block.name,
              timestamp: ts,
              duration_ms: null, // not available without timing data
              success: true, // assume success; error checked later
            });
          }
        }
      }
    }

    // Check tool results to mark failures
    if (line.type === "user") {
      const msg = line.message as { content?: Array<{ type: string; is_error?: boolean; tool_use_id?: string }> };
      if (Array.isArray(msg?.content)) {
        for (const block of msg.content) {
          if (block.type === "tool_result" && block.is_error) {
            // Mark the last tool call as failed
            if (toolCalls.length > 0) {
              toolCalls[toolCalls.length - 1]!.success = false;
            }
          }
        }
      }
    }
  }

  // Extract input summary from first user message text
  for (const line of lines) {
    if (line.type === "user") {
      const msg = line.message as { role?: string; content?: unknown };
      if (msg?.role === "user") {
        const content = msg.content;
        if (typeof content === "string") {
          inputSummary = content.substring(0, 400);
          break;
        } else if (Array.isArray(content)) {
          for (const block of content as Array<{ type: string; text?: string }>) {
            if (block.type === "text" && block.text) {
              inputSummary = block.text.substring(0, 400);
              break;
            }
          }
          if (inputSummary) break;
        }
      }
    }
  }

  void sessionEnd;

  return {
    tool_calls: toolCalls,
    input_summary: inputSummary,
    output_summary: outputSummary,
    tokens_input: hasUsage ? totalInputTokens : null,
    tokens_output: hasUsage ? totalOutputTokens : null,
    cost_usd: hasUsage ? estimateCost(model ?? undefined, totalInputTokens, totalOutputTokens) : null,
    model,
  };
}

function parseStepDir(dirName: string): { number: number; name: string } | null {
  const match = dirName.match(/^step-(\d+)-(.+)$/);
  if (!match) return null;
  return { number: parseInt(match[1]!, 10), name: match[2]! };
}

function parseAttemptDir(dirName: string): { featureId: string; attempt: number } | null {
  const match = dirName.match(/^(F-\d+)-attempt-(\d+)$/);
  if (!match) return null;
  return { featureId: match[1]!, attempt: parseInt(match[2]!, 10) };
}

// ---- Main trace builder ----

export async function buildTrace(
  workspaceDir: string,
  waveNumber: number,
  projectId: string,
  projectSlug: string,
  projectDataDir: string
): Promise<PipelineTrace> {
  const traceId = `${projectSlug}-wave-${waveNumber}`;
  const waveDir = path.join(workspaceDir, `wave-${waveNumber}`);

  const spans: TraceSpan[] = [];

  // ---- Collect all step dirs ----
  const allDirs = await listDirs(waveDir);

  const stepEntries = allDirs
    .map((d) => ({ dir: d, parsed: parseStepDir(d) }))
    .filter((x): x is { dir: string; parsed: NonNullable<typeof x.parsed> } => x.parsed !== null)
    .sort((a, b) => a.parsed.number - b.parsed.number);

  // Check for merge dir
  const hasMerge = allDirs.includes("merge");

  // Determine wave boundaries from steps
  let waveStartedAt: string | null = null;
  let waveEndedAt: string | null = null;
  let waveRunning = false;
  let waveFailed = false;

  const waveSpanId = `${traceId}-wave`;

  // ---- Process each step dir ----
  for (const { dir, parsed } of stepEntries) {
    const stepPath = path.join(waveDir, dir);
    const spawn = await safeReadJSON<SpawnMeta>(path.join(stepPath, "spawn.json"));

    const stepSpanId = `${traceId}-step-${parsed.number}-${parsed.name}`;
    const stepStatus = spawnStatusToSpanStatus(spawn);

    if (spawn?.started_at) {
      if (!waveStartedAt || spawn.started_at < waveStartedAt) {
        waveStartedAt = spawn.started_at;
      }
    }
    if (spawn?.finished_at) {
      if (!waveEndedAt || spawn.finished_at > waveEndedAt) {
        waveEndedAt = spawn.finished_at;
      }
    }
    if (stepStatus === "running") waveRunning = true;
    if (stepStatus === "failed") waveFailed = true;

    const isLoop = parsed.name === "ralph-wiggum-loop";

    // Parse spawn.jsonl for this step (for non-loop steps)
    let stepAgentCallSpan: TraceSpan | null = null;
    if (!isLoop) {
      const jsonlPath = path.join(stepPath, "spawn.jsonl");
      if (await fileExists(jsonlPath)) {
        const parsed2 = await parseSpawnJsonl(jsonlPath);
        const agentCallId = `${stepSpanId}-agent-call`;
        stepAgentCallSpan = {
          id: agentCallId,
          parent_id: stepSpanId,
          trace_id: traceId,
          name: `agent: ${spawn?.task ?? parsed.name}`,
          type: "agent_call",
          status: stepStatus,
          started_at: spawn?.started_at ?? new Date().toISOString(),
          ended_at: spawn?.finished_at ?? null,
          duration_ms: computeDuration(spawn?.started_at, spawn?.finished_at),
          metadata: {
            task: spawn?.task,
            agent: spawn?.agent,
            model: parsed2.model,
          },
          input_summary: parsed2.input_summary,
          output_summary: parsed2.output_summary,
          tokens_input: parsed2.tokens_input,
          tokens_output: parsed2.tokens_output,
          cost_usd: parsed2.cost_usd,
          tool_calls: parsed2.tool_calls,
          exit_code: spawn?.exit_code ?? null,
          error: spawn?.exit_code !== 0 ? `Exit code ${spawn?.exit_code}` : null,
        };
      }
    }

    // Create step span
    const stepSpan: TraceSpan = {
      id: stepSpanId,
      parent_id: waveSpanId,
      trace_id: traceId,
      name: isLoop
        ? `loop: ralph-wiggum`
        : parsed.name === "merge-worktree"
        ? `merge: worktree`
        : `step ${parsed.number}: ${parsed.name}`,
      type: isLoop ? "step" : parsed.name === "merge-worktree" ? "merge" : "step",
      status: stepStatus,
      started_at: spawn?.started_at ?? new Date().toISOString(),
      ended_at: spawn?.finished_at ?? null,
      duration_ms: computeDuration(spawn?.started_at, spawn?.finished_at),
      metadata: {
        step_number: parsed.number,
        task: spawn?.task ?? parsed.name,
        agent: spawn?.agent ?? "unknown",
        pid: spawn?.pid,
        timed_out: spawn?.timed_out ?? false,
      },
      input_summary: null,
      output_summary: null,
      tokens_input: null,
      tokens_output: null,
      cost_usd: null,
      tool_calls: [],
      exit_code: spawn?.exit_code ?? null,
      error:
        spawn?.timed_out
          ? "Step timed out"
          : spawn?.exit_code != null && spawn.exit_code !== 0
          ? `Exit code ${spawn.exit_code}`
          : null,
    };

    spans.push(stepSpan);

    if (stepAgentCallSpan) {
      spans.push(stepAgentCallSpan);
    }

    // ---- For ralph-wiggum-loop: process feature attempts ----
    if (isLoop) {
      const loopMeta = await safeReadJSON<LoopMeta>(path.join(stepPath, "loop.json"));
      const subDirs = await listDirs(stepPath);
      const attemptEntries = subDirs
        .map((d) => ({ dir: d, parsed: parseAttemptDir(d) }))
        .filter((x): x is { dir: string; parsed: NonNullable<typeof x.parsed> } => x.parsed !== null)
        .sort((a, b) => {
          const fa = a.parsed.featureId.localeCompare(b.parsed.featureId);
          return fa !== 0 ? fa : a.parsed.attempt - b.parsed.attempt;
        });

      // Update step span metadata with loop info
      if (loopMeta) {
        stepSpan.metadata = {
          ...stepSpan.metadata,
          loop_status: loopMeta.status,
          loop_iteration: loopMeta.iteration,
          loop_total: loopMeta.total,
          loop_done: loopMeta.done,
          loop_features_done: loopMeta.features_done,
        };
      }

      for (const { dir: attemptDir, parsed: attemptParsed } of attemptEntries) {
        const attemptPath = path.join(stepPath, attemptDir);
        const attemptSpawn = await safeReadJSON<SpawnMeta>(path.join(attemptPath, "spawn.json"));

        const featureAttemptId = `${traceId}-${attemptParsed.featureId}-attempt-${attemptParsed.attempt}`;
        const attemptStatus = spawnStatusToSpanStatus(attemptSpawn);

        const featureAttemptSpan: TraceSpan = {
          id: featureAttemptId,
          parent_id: stepSpanId,
          trace_id: traceId,
          name: `${attemptParsed.featureId} attempt ${attemptParsed.attempt}`,
          type: "feature_attempt",
          status: attemptStatus,
          started_at: attemptSpawn?.started_at ?? new Date().toISOString(),
          ended_at: attemptSpawn?.finished_at ?? null,
          duration_ms: computeDuration(attemptSpawn?.started_at, attemptSpawn?.finished_at),
          metadata: {
            feature_id: attemptParsed.featureId,
            attempt: attemptParsed.attempt,
            task: attemptSpawn?.task,
            agent: attemptSpawn?.agent,
            pid: attemptSpawn?.pid,
          },
          input_summary: null,
          output_summary: null,
          tokens_input: null,
          tokens_output: null,
          cost_usd: null,
          tool_calls: [],
          exit_code: attemptSpawn?.exit_code ?? null,
          error:
            attemptSpawn?.exit_code != null && attemptSpawn.exit_code !== 0
              ? `Exit code ${attemptSpawn.exit_code}`
              : null,
        };

        spans.push(featureAttemptSpan);

        // Parse spawn.jsonl for this attempt → agent_call span
        const attemptJsonlPath = path.join(attemptPath, "spawn.jsonl");
        if (await fileExists(attemptJsonlPath)) {
          const parsed2 = await parseSpawnJsonl(attemptJsonlPath);
          const agentCallId = `${featureAttemptId}-agent-call`;

          const agentCallSpan: TraceSpan = {
            id: agentCallId,
            parent_id: featureAttemptId,
            trace_id: traceId,
            name: `agent: ${attemptSpawn?.task ?? "vibe-code"} (${attemptParsed.featureId})`,
            type: "agent_call",
            status: attemptStatus,
            started_at: attemptSpawn?.started_at ?? new Date().toISOString(),
            ended_at: attemptSpawn?.finished_at ?? null,
            duration_ms: computeDuration(attemptSpawn?.started_at, attemptSpawn?.finished_at),
            metadata: {
              feature_id: attemptParsed.featureId,
              attempt: attemptParsed.attempt,
              task: attemptSpawn?.task,
              agent: attemptSpawn?.agent,
              model: parsed2.model,
            },
            input_summary: parsed2.input_summary,
            output_summary: parsed2.output_summary,
            tokens_input: parsed2.tokens_input,
            tokens_output: parsed2.tokens_output,
            cost_usd: parsed2.cost_usd,
            tool_calls: parsed2.tool_calls,
            exit_code: attemptSpawn?.exit_code ?? null,
            error:
              attemptSpawn?.exit_code != null && attemptSpawn.exit_code !== 0
                ? `Exit code ${attemptSpawn.exit_code}`
                : null,
          };

          spans.push(agentCallSpan);

          // Propagate token/cost data up to feature_attempt span
          featureAttemptSpan.tokens_input = parsed2.tokens_input;
          featureAttemptSpan.tokens_output = parsed2.tokens_output;
          featureAttemptSpan.cost_usd = parsed2.cost_usd;
          featureAttemptSpan.input_summary = parsed2.input_summary;
          featureAttemptSpan.output_summary = parsed2.output_summary;
        }
      }
    }
  }

  // ---- Process merge dir ----
  if (hasMerge) {
    const mergePath = path.join(waveDir, "merge");
    const mergeSpawn = await safeReadJSON<SpawnMeta>(path.join(mergePath, "spawn.json"));
    const mergeStatus = spawnStatusToSpanStatus(mergeSpawn);
    const mergeSpanId = `${traceId}-merge`;

    if (mergeSpawn?.started_at) {
      if (!waveStartedAt || mergeSpawn.started_at < waveStartedAt) {
        waveStartedAt = mergeSpawn.started_at;
      }
    }
    if (mergeSpawn?.finished_at) {
      if (!waveEndedAt || mergeSpawn.finished_at > waveEndedAt) {
        waveEndedAt = mergeSpawn.finished_at;
      }
    }
    if (mergeStatus === "running") waveRunning = true;
    if (mergeStatus === "failed") waveFailed = true;

    const mergeSpan: TraceSpan = {
      id: mergeSpanId,
      parent_id: waveSpanId,
      trace_id: traceId,
      name: "merge: worktree",
      type: "merge",
      status: mergeStatus,
      started_at: mergeSpawn?.started_at ?? new Date().toISOString(),
      ended_at: mergeSpawn?.finished_at ?? null,
      duration_ms: computeDuration(mergeSpawn?.started_at, mergeSpawn?.finished_at),
      metadata: {
        task: mergeSpawn?.task,
        agent: mergeSpawn?.agent,
        pid: mergeSpawn?.pid,
      },
      input_summary: null,
      output_summary: null,
      tokens_input: null,
      tokens_output: null,
      cost_usd: null,
      tool_calls: [],
      exit_code: mergeSpawn?.exit_code ?? null,
      error:
        mergeSpawn?.exit_code != null && mergeSpawn.exit_code !== 0
          ? `Exit code ${mergeSpawn.exit_code}`
          : null,
    };

    spans.push(mergeSpan);

    // Parse merge spawn.jsonl → agent_call span
    const mergeJsonlPath = path.join(mergePath, "spawn.jsonl");
    if (await fileExists(mergeJsonlPath)) {
      const parsed2 = await parseSpawnJsonl(mergeJsonlPath);
      const agentCallId = `${mergeSpanId}-agent-call`;

      spans.push({
        id: agentCallId,
        parent_id: mergeSpanId,
        trace_id: traceId,
        name: `agent: merge-worktree`,
        type: "agent_call",
        status: mergeStatus,
        started_at: mergeSpawn?.started_at ?? new Date().toISOString(),
        ended_at: mergeSpawn?.finished_at ?? null,
        duration_ms: computeDuration(mergeSpawn?.started_at, mergeSpawn?.finished_at),
        metadata: {
          task: mergeSpawn?.task,
          agent: mergeSpawn?.agent,
          model: parsed2.model,
        },
        input_summary: parsed2.input_summary,
        output_summary: parsed2.output_summary,
        tokens_input: parsed2.tokens_input,
        tokens_output: parsed2.tokens_output,
        cost_usd: parsed2.cost_usd,
        tool_calls: parsed2.tool_calls,
        exit_code: mergeSpawn?.exit_code ?? null,
        error:
          mergeSpawn?.exit_code != null && mergeSpawn.exit_code !== 0
            ? `Exit code ${mergeSpawn.exit_code}`
            : null,
      });
    }
  }

  // ---- Compute wave status ----
  const waveTraceStatus: TraceStatus = waveRunning
    ? "running"
    : waveFailed
    ? "failed"
    : "completed";

  // ---- Create wave span ----
  const effectiveWaveStart = waveStartedAt ?? new Date().toISOString();
  const waveSpan: TraceSpan = {
    id: waveSpanId,
    parent_id: null,
    trace_id: traceId,
    name: `wave ${waveNumber}`,
    type: "wave",
    status: waveTraceStatus === "running" ? "running" : waveTraceStatus === "failed" ? "failed" : "completed",
    started_at: effectiveWaveStart,
    ended_at: waveTraceStatus !== "running" ? waveEndedAt : null,
    duration_ms: waveTraceStatus !== "running" ? computeDuration(waveStartedAt ?? undefined, waveEndedAt ?? undefined) : null,
    metadata: {
      wave_number: waveNumber,
      step_count: stepEntries.length,
      has_loop: stepEntries.some((e) => e.parsed.name === "ralph-wiggum-loop"),
      has_merge: hasMerge,
    },
    input_summary: null,
    output_summary: null,
    tokens_input: null,
    tokens_output: null,
    cost_usd: null,
    tool_calls: [],
    exit_code: null,
    error: null,
  };

  // Prepend wave span so it's first
  spans.unshift(waveSpan);

  // ---- Assemble trace ----
  const trace: PipelineTrace = {
    trace_id: traceId,
    project_id: projectId,
    wave: waveNumber,
    started_at: effectiveWaveStart,
    ended_at: waveTraceStatus !== "running" ? waveEndedAt : null,
    status: waveTraceStatus,
    spans,
  };

  // ---- Persist to traces/wave-{n}/trace.json ----
  const tracePath = path.join(projectDataDir, "traces", `wave-${waveNumber}`, "trace.json");
  await ensureDir(path.dirname(tracePath));
  await writeJSON(tracePath, trace);

  return trace;
}

export async function loadOrBuildTrace(
  workspaceDir: string,
  waveNumber: number,
  projectId: string,
  projectSlug: string,
  projectDataDir: string
): Promise<PipelineTrace> {
  const tracePath = path.join(projectDataDir, "traces", `wave-${waveNumber}`, "trace.json");
  try {
    return await readJSON<PipelineTrace>(tracePath);
  } catch {
    return buildTrace(workspaceDir, waveNumber, projectId, projectSlug, projectDataDir);
  }
}

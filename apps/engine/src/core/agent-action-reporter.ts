/**
 * AgentActionReporter — registers AgentAction lifecycle events with the hub API.
 *
 * (1) On spawn start: POST /agent-actions with status=running
 * (2) On spawn complete: PATCH /agent-actions/:id with final status, duration, output_preview
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type AgentActionType =
  | 'feature_spawn'
  | 'pipeline_phase'
  | 'review_spawn'
  | 'merge_spawn';

export interface ReportStartParams {
  projectSlug: string;
  actionType: AgentActionType;
  agentProfile?: string;
  taskName?: string;
  featureId?: string;
  spawnDir?: string;
}

export interface ReportCompleteParams {
  projectSlug: string;
  actionId: string;
  exitCode: number;
  startedAt: string;
  outputDir: string;
}

interface CreateActionResponse {
  id: string;
}

export class AgentActionReporter {
  private readonly hubBaseUrl: string;

  constructor(hubBaseUrl?: string) {
    this.hubBaseUrl = hubBaseUrl ?? process.env.AW_HUB_URL ?? 'http://localhost:3000';
  }

  /**
   * Register a new AgentAction with status=running.
   * Returns the action_id for subsequent PATCH, or null on failure.
   */
  async reportStart(params: ReportStartParams): Promise<string | null> {
    const { projectSlug, actionType, agentProfile, taskName, featureId, spawnDir } = params;

    if (!projectSlug) return null;

    const body: Record<string, unknown> = {
      action_type: actionType,
      started_at: new Date().toISOString(),
      requires_approval: false,
    };

    if (agentProfile) body.agent_profile = agentProfile;
    if (taskName) body.task_name = taskName;
    if (featureId) body.feature_id = featureId;
    if (spawnDir) body.spawn_dir = spawnDir;

    try {
      const url = `${this.hubBaseUrl}/api/v1/hub/projects/${encodeURIComponent(projectSlug)}/agent-actions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.warn(`[agent-action] Hub returned ${response.status} on POST for ${actionType}/${taskName ?? 'unknown'}`);
        return null;
      }

      const data = (await response.json()) as CreateActionResponse;
      return data.id ?? null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[agent-action] Failed to report start: ${msg}`);
      return null;
    }
  }

  /**
   * Update an existing AgentAction with completion data.
   */
  async reportComplete(params: ReportCompleteParams): Promise<void> {
    const { projectSlug, actionId, exitCode, startedAt, outputDir } = params;

    if (!projectSlug || !actionId) return;

    const completedAt = new Date().toISOString();
    const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();

    const status = exitCode === 0 ? 'completed' : 'failed';

    const outputPreview = await this.extractOutputPreview(outputDir);

    const body: Record<string, unknown> = {
      status,
      completed_at: completedAt,
      duration_ms: Math.max(0, durationMs),
      exit_code: exitCode,
    };

    if (outputPreview) body.output_preview = outputPreview;

    try {
      const url = `${this.hubBaseUrl}/api/v1/hub/projects/${encodeURIComponent(projectSlug)}/agent-actions/${encodeURIComponent(actionId)}`;
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.warn(`[agent-action] Hub returned ${response.status} on PATCH for action ${actionId}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[agent-action] Failed to report complete: ${msg}`);
    }
  }

  /**
   * Extract the first 500 chars of the last assistant message from spawn.jsonl.
   */
  private async extractOutputPreview(outputDir: string): Promise<string | null> {
    const logPath = join(outputDir, 'spawn.jsonl');

    let content: string;
    try {
      content = await readFile(logPath, 'utf-8');
    } catch {
      return null;
    }

    const lines = content.trim().split('\n');

    // Walk backwards to find the last assistant message
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]!) as Record<string, unknown>;

        // stream-json format: { type: "assistant", message: { content: [...] } }
        if (obj.type === 'assistant' && obj.message) {
          const message = obj.message as Record<string, unknown>;
          if (Array.isArray(message.content)) {
            const textParts = (message.content as Array<{ type: string; text?: string }>)
              .filter((p) => p.type === 'text' && p.text)
              .map((p) => p.text!);
            const fullText = textParts.join('\n');
            if (fullText.length > 0) {
              return fullText.slice(0, 500);
            }
          }
        }

        // json format (non-streaming): { role: "assistant", content: "..." }
        if (obj.role === 'assistant' && typeof obj.content === 'string' && obj.content.length > 0) {
          return (obj.content as string).slice(0, 500);
        }
      } catch {
        // skip unparseable lines
      }
    }

    return null;
  }
}

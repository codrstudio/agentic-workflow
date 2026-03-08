/**
 * TokenUsageReporter — extracts token usage from spawn.jsonl and reports
 * it to the hub API via POST /api/v1/hub/projects/:slug/token-usage.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export type TokenUsageContext =
  | 'pipeline_phase'
  | 'feature_spawn'
  | 'review_agent'
  | 'merge_agent';

export interface ReportTokenUsageParams {
  projectSlug: string;
  outputDir: string;
  context: TokenUsageContext;
  phase?: string;
  featureId?: string;
  resolvedModel?: string;
}

interface SpawnJsonlResult {
  type: 'result';
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  total_cost_usd?: number;
  session_id?: string;
}

/** Map short model names used by the engine to the API enum values. */
const MODEL_MAP: Record<string, string> = {
  'haiku': 'claude-haiku-4-5',
  'sonnet': 'claude-sonnet-4-6',
  'opus': 'claude-opus-4-6',
  'claude-haiku-4-5': 'claude-haiku-4-5',
  'claude-sonnet-4-6': 'claude-sonnet-4-6',
  'claude-opus-4-6': 'claude-opus-4-6',
};

export class TokenUsageReporter {
  private readonly hubBaseUrl: string;

  constructor(hubBaseUrl?: string) {
    this.hubBaseUrl = hubBaseUrl ?? process.env.ARC_HUB_URL ?? 'http://localhost:3000';
  }

  /**
   * Parse the spawn.jsonl file and POST token usage to the hub.
   * Fails silently (logs warning) if tokens are missing or hub is unreachable.
   */
  async report(params: ReportTokenUsageParams): Promise<void> {
    const { projectSlug, outputDir, context, phase, featureId, resolvedModel } = params;

    if (!projectSlug) return;

    const usage = await this.extractUsage(outputDir);
    if (!usage) {
      console.warn(`[token-usage] No usage data in spawn.jsonl at ${outputDir}, skipping report`);
      return;
    }

    const model = this.resolveModelEnum(resolvedModel);

    const body: Record<string, unknown> = {
      context,
      model,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_read_tokens: usage.cache_read_tokens,
    };

    if (phase) body.phase = phase;
    if (featureId) body.feature_id = featureId;
    if (usage.session_id) body.session_id = usage.session_id;

    try {
      const url = `${this.hubBaseUrl}/api/v1/hub/projects/${encodeURIComponent(projectSlug)}/token-usage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.warn(`[token-usage] Hub returned ${response.status} for ${context}/${phase ?? 'no-phase'}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[token-usage] Failed to report usage: ${msg}`);
    }
  }

  /**
   * Extract aggregated usage from the "result" line in spawn.jsonl.
   */
  private async extractUsage(
    outputDir: string,
  ): Promise<{ input_tokens: number; output_tokens: number; cache_read_tokens: number; session_id?: string } | null> {
    const logPath = join(outputDir, 'spawn.jsonl');

    let content: string;
    try {
      content = await readFile(logPath, 'utf-8');
    } catch {
      return null;
    }

    // Read lines in reverse to find the "result" line (typically the last line)
    const lines = content.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]!) as SpawnJsonlResult;
        if (obj.type === 'result' && obj.usage) {
          const u = obj.usage;
          if (typeof u.input_tokens !== 'number' || typeof u.output_tokens !== 'number') {
            return null;
          }
          return {
            input_tokens: u.input_tokens,
            output_tokens: u.output_tokens,
            cache_read_tokens: u.cache_read_input_tokens ?? 0,
            session_id: obj.session_id,
          };
        }
      } catch {
        // skip unparseable lines
      }
    }

    return null;
  }

  /**
   * Map the engine's resolved model string to the API enum value.
   */
  private resolveModelEnum(resolvedModel?: string): string {
    if (!resolvedModel) return 'other';
    const mapped = MODEL_MAP[resolvedModel];
    if (mapped) return mapped;
    // Check if it starts with a known prefix
    if (resolvedModel.startsWith('claude-haiku')) return 'claude-haiku-4-5';
    if (resolvedModel.startsWith('claude-sonnet')) return 'claude-sonnet-4-6';
    if (resolvedModel.startsWith('claude-opus')) return 'claude-opus-4-6';
    return 'other';
  }
}

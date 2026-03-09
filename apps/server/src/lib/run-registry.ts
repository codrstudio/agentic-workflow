import { randomUUID } from 'node:crypto';
import { WorkflowRunner } from '@aw/engine';
import type { WorkflowRunnerContext } from '@aw/engine';

export interface RunRecord {
  id: string;
  projectSlug: string;
  workflowSlug: string;
  planSlug?: string;
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'failed';
  created_at: string;
  started_at?: string;
  finished_at?: string;
  exit_code?: number;
  reason?: string;
  ctx?: WorkflowRunnerContext;
  runner?: WorkflowRunner;
}

export class RunRegistry {
  private runs = new Map<string, RunRecord>();

  create(projectSlug: string, workflowSlug: string, planSlug?: string): RunRecord {
    const id = randomUUID();
    const run: RunRecord = {
      id,
      projectSlug,
      workflowSlug,
      planSlug,
      status: 'pending',
      created_at: new Date().toISOString(),
    };
    this.runs.set(id, run);
    return run;
  }

  get(runId: string): RunRecord | null {
    return this.runs.get(runId) ?? null;
  }

  list(projectSlug?: string): RunRecord[] {
    const records = Array.from(this.runs.values());
    if (!projectSlug) {
      return records;
    }
    return records.filter((r) => r.projectSlug === projectSlug);
  }

  update(runId: string, updates: Partial<RunRecord>): RunRecord | null {
    const run = this.runs.get(runId);
    if (!run) {
      return null;
    }
    const updated = { ...run, ...updates };
    this.runs.set(runId, updated);
    return updated;
  }

  private static instance: RunRegistry;

  static getInstance(): RunRegistry {
    if (!RunRegistry.instance) {
      RunRegistry.instance = new RunRegistry();
    }
    return RunRegistry.instance;
  }
}

// Export singleton instance
export const registry = RunRegistry.getInstance();

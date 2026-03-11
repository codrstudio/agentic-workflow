import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isPidAlive } from './pid-check.js';

export async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as unknown;
}

export interface WorkflowStateStep {
  index: number;
  task: string;
  type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
}

export interface WorkflowState {
  workflow: string;
  wave: number;
  sprint: number;
  initialized_at: string;
  steps: WorkflowStateStep[];
}

export async function readWorkflowState(waveDir: string): Promise<WorkflowState | null> {
  try {
    return await readJson(path.join(waveDir, 'workflow-state.json')) as WorkflowState;
  } catch {
    return null;
  }
}

export interface SpawnJson {
  task?: string;
  agent?: string;
  wave?: number;
  step?: number;
  pid?: number;
  parent_pid?: number;
  started_at?: string;
  finished_at?: string;
  exit_code?: number;
  timed_out?: boolean;
  model_used?: string;
}

export interface LoopJson {
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
  max_iterations?: number | null;
  max_features?: number | null;
  exit_reason?: string;
}

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'interrupted';

export function deriveStatus(spawn: SpawnJson | null, dirExists: boolean): StepStatus {
  if (!dirExists) return 'pending';
  if (!spawn) return 'running';
  if (spawn.exit_code === undefined || spawn.exit_code === null) {
    if (spawn.pid !== undefined && spawn.pid !== null) {
      return isPidAlive(spawn.pid) ? 'running' : 'interrupted';
    }
    return 'running';
  }
  return spawn.exit_code === 0 ? 'completed' : 'failed';
}

export function parseStepDir(dirName: string): { index: number; task: string; isLoop: boolean } | null {
  const match = /^step-(\d+)-(.+)$/.exec(dirName);
  if (!match) return null;
  const index = parseInt(match[1]!, 10);
  const task = match[2]!;
  return { index, task, isLoop: task === 'ralph-wiggum-loop' };
}

export async function readStepSummary(
  waveDir: string,
  dirName: string
): Promise<{
  index: number;
  task: string;
  type: 'spawn-agent' | 'ralph-wiggum-loop';
  status: StepStatus;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
  exit_code?: number;
} | null> {
  const parsed = parseStepDir(dirName);
  if (!parsed) return null;

  const stepDir = path.join(waveDir, dirName);

  if (parsed.isLoop) {
    const loopFile = path.join(stepDir, 'loop.json');
    let loop: LoopJson | null = null;
    try {
      loop = await readJson(loopFile) as LoopJson;
    } catch {
      // loop.json may not exist yet
    }

    let status: StepStatus = 'running';
    if (!loop) {
      status = 'running';
    } else if (loop.status === 'exited') {
      const reason = loop.exit_reason ?? '';
      const isError = reason.startsWith('error:');
      status = isError ? 'failed' : 'completed';
    } else if (loop.status === 'starting' || loop.status === 'running' || loop.status === 'between') {
      if (loop.pid !== undefined && loop.pid !== null) {
        status = isPidAlive(loop.pid) ? 'running' : 'interrupted';
      } else {
        status = 'running';
      }
    }

    let duration_ms: number | undefined;
    if (loop?.started_at && loop.updated_at) {
      duration_ms = new Date(loop.updated_at).getTime() - new Date(loop.started_at).getTime();
    }

    return {
      index: parsed.index,
      task: parsed.task,
      type: 'ralph-wiggum-loop',
      status,
      started_at: loop?.started_at,
      finished_at: loop?.updated_at,
      duration_ms,
    };
  }

  // Regular step
  const spawnFile = path.join(stepDir, 'spawn.json');
  let spawn: SpawnJson | null = null;
  try {
    spawn = await readJson(spawnFile) as SpawnJson;
  } catch {
    // spawn.json may not exist yet
  }

  const status = deriveStatus(spawn, true);

  let duration_ms: number | undefined;
  if (spawn?.started_at && spawn?.finished_at) {
    duration_ms = new Date(spawn.finished_at).getTime() - new Date(spawn.started_at).getTime();
  }

  return {
    index: parsed.index,
    task: parsed.task,
    type: 'spawn-agent',
    status,
    started_at: spawn?.started_at,
    finished_at: spawn?.finished_at,
    duration_ms,
    exit_code: spawn?.exit_code,
  };
}

export async function listWaveDirs(workspaceDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(workspaceDir);
  } catch {
    return [];
  }
  return entries
    .filter((e) => /^wave-\d+$/.test(e))
    .sort((a, b) => {
      const na = parseInt(a.replace('wave-', ''), 10);
      const nb = parseInt(b.replace('wave-', ''), 10);
      return na - nb;
    });
}

export async function listStepDirs(waveDir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(waveDir);
  } catch {
    return [];
  }
  return entries
    .filter((e) => /^step-\d+-.+$/.test(e))
    .sort((a, b) => {
      const na = parseInt(a.replace(/^step-/, ''), 10);
      const nb = parseInt(b.replace(/^step-/, ''), 10);
      return na - nb;
    });
}

export type StepSummary = NonNullable<Awaited<ReturnType<typeof readStepSummary>>>;

export async function buildStepList(wavePath: string): Promise<StepSummary[]> {
  const wfState = await readWorkflowState(wavePath);
  const stepDirNames = await listStepDirs(wavePath);

  if (!wfState || !Array.isArray(wfState.steps)) {
    return (await Promise.all(stepDirNames.map((d) => readStepSummary(wavePath, d)))).filter(Boolean) as StepSummary[];
  }

  const runtimeSteps = new Map<number, StepSummary>();
  for (const dirName of stepDirNames) {
    const summary = await readStepSummary(wavePath, dirName);
    if (summary) runtimeSteps.set(summary.index, summary);
  }

  return wfState.steps.map((ws) => {
    const runtime = runtimeSteps.get(ws.index);
    if (runtime) return runtime;

    const wfStatus = (ws.status as StepStatus | undefined) ?? 'pending';
    return {
      index: ws.index,
      task: ws.task,
      type: (ws.type === 'ralph-wiggum-loop' ? 'ralph-wiggum-loop' : 'spawn-agent') as 'spawn-agent' | 'ralph-wiggum-loop',
      status: wfStatus,
      started_at: ws.started_at ?? undefined,
      finished_at: ws.completed_at ?? undefined,
      duration_ms: undefined,
      exit_code: ws.exit_code ?? undefined,
    };
  });
}

export type LogLineType = 'system' | 'assistant' | 'tool_use' | 'tool_result' | 'user';

export interface ParsedLogLine {
  index: number;
  type: LogLineType;
  raw: unknown;
}

export function classifyLine(obj: Record<string, unknown>): LogLineType {
  const t = obj['type'];
  if (t === 'assistant') {
    const msg = obj['message'] as Record<string, unknown> | undefined;
    const content = Array.isArray(msg?.['content']) ? (msg!['content'] as Array<Record<string, unknown>>) : [];
    if (content.some((c) => c['type'] === 'tool_use')) return 'tool_use';
    return 'assistant';
  }
  if (t === 'user') {
    const msg = obj['message'] as Record<string, unknown> | undefined;
    const content = Array.isArray(msg?.['content']) ? (msg!['content'] as Array<Record<string, unknown>>) : [];
    if (content.some((c) => c['type'] === 'tool_result')) return 'tool_result';
    return 'user';
  }
  if (t === 'system') return 'system';
  return 'system';
}

export async function parseSpawnJsonl(jsonlPath: string): Promise<ParsedLogLine[]> {
  let content: string;
  try {
    content = await fs.readFile(jsonlPath, 'utf-8');
  } catch {
    return [];
  }
  const lines = content.split('\n').filter((l) => l.trim());
  const result: ParsedLogLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]!) as Record<string, unknown>;
      result.push({ index: i, type: classifyLine(obj), raw: obj });
    } catch {
      // skip non-JSON lines
    }
  }
  return result;
}

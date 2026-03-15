import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isPidAlive } from './pid-check.js';

export async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as unknown;
}

/** Returns the latest attempt-N/ subdir inside stepDir, or stepDir itself if none exist. */
export async function resolveLatestAttemptDir(stepDir: string): Promise<string> {
  const entries = await fs.readdir(stepDir).catch(() => [] as string[]);
  const attempts = entries.filter((e) => /^attempt-\d+$/.test(e));
  if (attempts.length === 0) return stepDir;
  const sorted = attempts.sort((a, b) =>
    parseInt(a.replace('attempt-', ''), 10) - parseInt(b.replace('attempt-', ''), 10),
  );
  return path.join(stepDir, sorted[sorted.length - 1]!);
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

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'interrupted' | 'skipped';

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
    const loopDir = await resolveLatestAttemptDir(stepDir);
    const loopFile = path.join(loopDir, 'loop.json');
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
  let spawn: SpawnJson | null = null;
  try {
    const attemptDir = await resolveLatestAttemptDir(stepDir);
    spawn = await readJson(path.join(attemptDir, 'spawn.json')) as SpawnJson;
  } catch {
    // attempt dir or spawn.json may not exist yet
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

export function deriveWaveStatus(steps: StepSummary[]): StepStatus {
  const total = steps.length;
  const running = steps.filter((s) => s.status === 'running').length;
  const interrupted = steps.filter((s) => s.status === 'interrupted').length;
  const failed = steps.filter((s) => s.status === 'failed').length;
  const done = steps.filter((s) => s.status === 'completed').length;
  const skipped = steps.filter((s) => s.status === 'skipped').length;
  if (running > 0) return 'running';
  if (interrupted > 0) return 'interrupted';
  if (failed > 0) return 'failed';
  if (done + skipped === total && total > 0) return 'completed';
  if (done > 0) return 'running';
  return 'pending';
}

export async function buildStepList(wavePath: string): Promise<StepSummary[]> {
  const wfState = await readWorkflowState(wavePath);
  const stepDirNames = await listStepDirs(wavePath);

  if (!wfState || !Array.isArray(wfState.steps)) {
    return (await Promise.all(stepDirNames.map((d) => readStepSummary(wavePath, d)))).filter(Boolean) as StepSummary[];
  }

  const wfTaskByIndex = new Map(wfState.steps.map((ws) => [ws.index, ws.task]));
  const runtimeSteps = new Map<number, StepSummary>();
  for (const dirName of stepDirNames) {
    const summary = await readStepSummary(wavePath, dirName);
    if (!summary) continue;
    const existing = runtimeSteps.get(summary.index);
    if (!existing) {
      runtimeSteps.set(summary.index, summary);
    } else {
      // Prefer the dir whose task matches workflow-state.json
      const expectedTask = wfTaskByIndex.get(summary.index);
      if (expectedTask && summary.task === expectedTask) {
        runtimeSteps.set(summary.index, summary);
      }
    }
  }

  return wfState.steps.map((ws) => {
    const runtime = runtimeSteps.get(ws.index);
    if (runtime) {
      const wfStatus = ws.status as StepStatus | undefined;
      // workflow-state.json is authoritative for 'running': filesystem may lag behind
      // (race between engine creating next attempt dir and server reading previous attempt)
      if (wfStatus === 'running' && runtime.status === 'interrupted') {
        return { ...runtime, status: 'running' as StepStatus };
      }
      // workflow-state.json is the engine's final verdict for failures too
      const wfFailed = wfStatus === 'failed' || (ws.exit_code !== null && ws.exit_code !== undefined && ws.exit_code !== 0);
      if (wfFailed && runtime.status === 'completed') {
        return { ...runtime, status: 'failed' as StepStatus };
      }
      return runtime;
    }

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

export interface TimingResult {
  started_at: string;
  elapsed_ms: number;
  completed_steps_avg_ms: number;
  completed_steps_total_ms: number;
  remaining_steps: number;
  estimated_remaining_ms: number;
  estimated_completion: string;
}

export function computeWaveTiming(steps: StepSummary[]): TimingResult | null {
  const firstStarted = steps.find((s) => s.started_at);
  if (!firstStarted?.started_at) return null;

  const completedSteps = steps.filter((s) => s.status === 'completed' && s.duration_ms !== undefined);
  if (completedSteps.length === 0) return null;

  const now = Date.now();
  const startedAtMs = new Date(firstStarted.started_at).getTime();
  const elapsed_ms = now - startedAtMs;

  const completed_steps_total_ms = completedSteps.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0);
  const completed_steps_avg_ms = completed_steps_total_ms / completedSteps.length;

  const completed = steps.filter((s) => s.status === 'completed').length;
  const skippedCount = steps.filter((s) => s.status === 'skipped').length;
  const remaining_steps = steps.length - completed - skippedCount;
  const estimated_remaining_ms = remaining_steps * completed_steps_avg_ms;
  const estimated_completion = new Date(now + estimated_remaining_ms).toISOString();

  return {
    started_at: firstStarted.started_at,
    elapsed_ms,
    completed_steps_avg_ms,
    completed_steps_total_ms,
    remaining_steps,
    estimated_remaining_ms,
    estimated_completion,
  };
}

export async function findLatestSprintDir(wavePath: string): Promise<{ sprintDir: string; sprintName: string } | null> {
  const sprintsDir = path.join(wavePath, 'worktree', 'sprints');
  let sprintDirs: string[];
  try {
    sprintDirs = await fs.readdir(sprintsDir);
  } catch {
    return null;
  }
  const latestSprint = sprintDirs
    .filter((d) => /^sprint-\d+$/.test(d))
    .sort((a, b) => parseInt(b.replace('sprint-', ''), 10) - parseInt(a.replace('sprint-', ''), 10))[0];
  if (!latestSprint) return null;
  return { sprintDir: path.join(sprintsDir, latestSprint), sprintName: latestSprint };
}

export function countFeaturesByStatus(features: Array<Record<string, unknown>>): {
  passing: number; failing: number; skipped: number;
  pending: number; in_progress: number; blocked: number;
} {
  return {
    passing: features.filter((f) => f['status'] === 'passing').length,
    failing: features.filter((f) => f['status'] === 'failing').length,
    skipped: features.filter((f) => f['status'] === 'skipped').length,
    pending: features.filter((f) => f['status'] === 'pending').length,
    in_progress: features.filter((f) => f['status'] === 'in_progress').length,
    blocked: features.filter((f) => f['status'] === 'blocked').length,
  };
}

export async function findActiveStepJsonl(waveDir: string): Promise<string | null> {
  const stepDirs = await listStepDirs(waveDir);
  const wfState = await readWorkflowState(waveDir);
  const wfRunningIndexes = new Set(
    wfState?.steps.filter((s) => s.status === 'running').map((s) => s.index) ?? [],
  );
  for (const dirName of [...stepDirs].reverse()) {
    const summary = await readStepSummary(waveDir, dirName);
    const isActive = summary?.status === 'running' ||
      (summary?.status === 'interrupted' && wfRunningIndexes.has(summary.index));
    if (isActive) {
      const parsed = parseStepDir(dirName);
      if (parsed?.isLoop) {
        const loopDir = path.join(waveDir, dirName);
        const latestAttemptDir = await resolveLatestAttemptDir(loopDir);
        try {
          const loopJson = await readJson(path.join(latestAttemptDir, 'loop.json')) as Record<string, unknown>;
          const featureId = loopJson['feature_id'] as string | null | undefined;
          if (featureId) {
            let attempt = 1;
            try {
              const entries = await fs.readdir(path.join(loopDir, '..', 'worktree', 'sprints'));
              const latestSprint = entries
                .filter((e) => /^sprint-\d+$/.test(e))
                .sort((a, b) => parseInt(b.replace('sprint-', ''), 10) - parseInt(a.replace('sprint-', ''), 10))[0];
              if (latestSprint) {
                const features = await readJson(path.join(loopDir, '..', 'worktree', 'sprints', latestSprint, 'features.json')) as Array<Record<string, unknown>>;
                const feature = features.find((f) => f['id'] === featureId);
                const retries = (feature?.['retries'] as number | undefined) ?? 0;
                attempt = retries + 1;
              }
            } catch { /* fallback to attempt 1 */ }
            const candidatePath = path.join(latestAttemptDir, `${featureId}-attempt-${attempt}`, 'spawn.jsonl');
            try {
              await fs.access(candidatePath);
              return candidatePath;
            } catch { /* file not yet created, fall through */ }
          }
        } catch { /* loop.json not readable */ }
        // Fallback: pick the most recently modified F-XXX-attempt-N dir inside latestAttemptDir
        try {
          const entries = await fs.readdir(latestAttemptDir);
          const attemptDirs = entries.filter((e) => /^F-\d+-attempt-\d+$/.test(e));
          if (attemptDirs.length > 0) {
            const withMtime = await Promise.all(
              attemptDirs.map(async (e) => {
                try {
                  const s = await fs.stat(path.join(latestAttemptDir, e));
                  return { name: e, mtime: s.mtimeMs };
                } catch { return { name: e, mtime: 0 }; }
              })
            );
            const latest = withMtime.sort((a, b) => b.mtime - a.mtime)[0];
            if (latest) return path.join(latestAttemptDir, latest.name, 'spawn.jsonl');
          }
        } catch { /* ignore */ }
      }
      try {
        const attemptDir = await resolveLatestAttemptDir(path.join(waveDir, dirName));
        return path.join(attemptDir, 'spawn.jsonl');
      } catch { /* attempt dir not yet created */ }
    }
  }
  return null;
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

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from '../lib/paths.js';
import { isPidAlive } from '../lib/pid-check.js';

const app = new Hono();

async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as unknown;
}

interface WorkflowStateStep {
  index: number;
  task: string;
  type: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
}

interface WorkflowState {
  workflow: string;
  wave: number;
  sprint: number;
  initialized_at: string;
  steps: WorkflowStateStep[];
}

async function readWorkflowState(waveDir: string): Promise<WorkflowState | null> {
  try {
    return await readJson(path.join(waveDir, 'workflow-state.json')) as WorkflowState;
  } catch {
    return null;
  }
}

interface SpawnJson {
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

interface LoopJson {
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

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'interrupted';

function deriveStatus(spawn: SpawnJson | null, dirExists: boolean): StepStatus {
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

function parseStepDir(dirName: string): { index: number; task: string; isLoop: boolean } | null {
  const match = /^step-(\d+)-(.+)$/.exec(dirName);
  if (!match) return null;
  const index = parseInt(match[1]!, 10);
  const task = match[2]!;
  return { index, task, isLoop: task === 'ralph-wiggum-loop' };
}

async function readStepSummary(
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
    try { loop = await readJson(loopFile) as LoopJson; } catch { /* may not exist */ }

    let status: StepStatus = 'running';
    if (!loop) {
      status = 'running';
    } else if (loop.status === 'exited') {
      status = (loop.exit_reason ?? '').startsWith('error:') ? 'failed' : 'completed';
    } else if (loop.status === 'starting' || loop.status === 'running' || loop.status === 'between') {
      if (loop.pid !== undefined && loop.pid !== null) {
        status = isPidAlive(loop.pid) ? 'running' : 'interrupted';
      }
    }

    let duration_ms: number | undefined;
    if (loop?.started_at && loop.updated_at) {
      duration_ms = new Date(loop.updated_at).getTime() - new Date(loop.started_at).getTime();
    }
    return { index: parsed.index, task: parsed.task, type: 'ralph-wiggum-loop', status, started_at: loop?.started_at, finished_at: loop?.updated_at, duration_ms };
  }

  const spawnFile = path.join(stepDir, 'spawn.json');
  let spawn: SpawnJson | null = null;
  try { spawn = await readJson(spawnFile) as SpawnJson; } catch { /* may not exist */ }

  const status = deriveStatus(spawn, true);
  let duration_ms: number | undefined;
  if (spawn?.started_at && spawn?.finished_at) {
    duration_ms = new Date(spawn.finished_at).getTime() - new Date(spawn.started_at).getTime();
  }
  return { index: parsed.index, task: parsed.task, type: 'spawn-agent', status, started_at: spawn?.started_at, finished_at: spawn?.finished_at, duration_ms, exit_code: spawn?.exit_code };
}

async function listWaveDirs(workspaceDir: string): Promise<string[]> {
  let entries: string[];
  try { entries = await fs.readdir(workspaceDir); } catch { return []; }
  return entries
    .filter((e) => /^wave-\d+$/.test(e))
    .sort((a, b) => parseInt(a.replace('wave-', ''), 10) - parseInt(b.replace('wave-', ''), 10));
}

async function listStepDirs(waveDir: string): Promise<string[]> {
  let entries: string[];
  try { entries = await fs.readdir(waveDir); } catch { return []; }
  return entries
    .filter((e) => /^step-\d+-.+$/.test(e))
    .sort((a, b) => parseInt(a.replace(/^step-/, ''), 10) - parseInt(b.replace(/^step-/, ''), 10));
}

type LogLineType = 'system' | 'assistant' | 'tool_use' | 'tool_result' | 'user';
interface ParsedLogLine { index: number; type: LogLineType; raw: unknown; }

function classifyLine(obj: Record<string, unknown>): LogLineType {
  const t = obj['type'];
  if (t === 'assistant') {
    const content = Array.isArray((obj['message'] as Record<string, unknown> | undefined)?.['content'])
      ? ((obj['message'] as Record<string, unknown>)['content'] as Array<Record<string, unknown>>)
      : [];
    if (content.some((c) => c['type'] === 'tool_use')) return 'tool_use';
    return 'assistant';
  }
  if (t === 'user') {
    const content = Array.isArray((obj['message'] as Record<string, unknown> | undefined)?.['content'])
      ? ((obj['message'] as Record<string, unknown>)['content'] as Array<Record<string, unknown>>)
      : [];
    if (content.some((c) => c['type'] === 'tool_result')) return 'tool_result';
    return 'user';
  }
  return 'system';
}

async function parseSpawnJsonl(jsonlPath: string): Promise<ParsedLogLine[]> {
  let content: string;
  try { content = await fs.readFile(jsonlPath, 'utf-8'); } catch { return []; }
  const lines = content.split('\n').filter((l) => l.trim());
  const result: ParsedLogLine[] = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]!) as Record<string, unknown>;
      result.push({ index: i, type: classifyLine(obj), raw: obj });
    } catch { /* skip */ }
  }
  return result;
}

async function formatLastOutput(jsonlPath: string): Promise<string[]> {
  const lines = await parseSpawnJsonl(jsonlPath);
  const readable: string[] = [];
  for (const line of lines) {
    const raw = line.raw as Record<string, unknown>;
    const msg = raw['message'] as Record<string, unknown> | undefined;
    const content = Array.isArray(msg?.['content']) ? (msg!['content'] as Array<Record<string, unknown>>) : [];
    if (line.type === 'assistant') {
      for (const block of content) {
        if (block['type'] === 'text' && typeof block['text'] === 'string') {
          const text = (block['text'] as string).trim();
          if (text) readable.push(text);
        }
      }
    } else if (line.type === 'tool_use') {
      for (const block of content) {
        if (block['type'] === 'tool_use' && typeof block['name'] === 'string') {
          readable.push(`→ tool: ${block['name'] as string}`);
        }
      }
    }
  }
  return readable.slice(-5);
}

async function findActiveStepJsonl(waveDir: string): Promise<string | null> {
  const stepDirs = await listStepDirs(waveDir);
  for (const dirName of [...stepDirs].reverse()) {
    const summary = await readStepSummary(waveDir, dirName);
    if (summary?.status === 'running') {
      const parsed = parseStepDir(dirName);
      if (parsed?.isLoop) {
        const loopDir = path.join(waveDir, dirName);
        try {
          const entries = await fs.readdir(loopDir);
          const attempts = entries.filter((e) => /^F-\d+-attempt-\d+$/.test(e)).sort().reverse();
          if (attempts[0]) return path.join(loopDir, attempts[0], 'spawn.jsonl');
        } catch { /* ignore */ }
      }
      return path.join(waveDir, dirName, 'spawn.jsonl');
    }
  }
  return null;
}

async function getLastOutputAge(jsonlPath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(jsonlPath);
    return Date.now() - stat.mtimeMs;
  } catch { return null; }
}

type StepSummary = NonNullable<Awaited<ReturnType<typeof readStepSummary>>>;

/**
 * Build step list from workflow-state.json as the authoritative source,
 * enriched with runtime data from step directories when available.
 * Falls back to directory-only scanning if workflow-state.json doesn't exist.
 */
async function buildStepList(wavePath: string): Promise<StepSummary[]> {
  const wfState = await readWorkflowState(wavePath);
  const stepDirNames = await listStepDirs(wavePath);

  if (!wfState || !Array.isArray(wfState.steps)) {
    // Fallback: directory-only (old behavior)
    return (await Promise.all(stepDirNames.map((d) => readStepSummary(wavePath, d)))).filter(Boolean) as StepSummary[];
  }

  // Build a map of runtime step data from directories
  const runtimeSteps = new Map<number, StepSummary>();
  for (const dirName of stepDirNames) {
    const summary = await readStepSummary(wavePath, dirName);
    if (summary) runtimeSteps.set(summary.index, summary);
  }

  // Use workflow-state steps as the base, enrich with runtime data
  return wfState.steps.map((ws) => {
    const runtime = runtimeSteps.get(ws.index);
    if (runtime) return runtime; // Prefer runtime data (has PID checks, accurate status)

    // No directory yet — pending step from workflow-state
    return {
      index: ws.index,
      task: ws.task,
      type: (ws.type === 'ralph-wiggum-loop' ? 'ralph-wiggum-loop' : 'spawn-agent') as 'spawn-agent' | 'ralph-wiggum-loop',
      status: 'pending' as StepStatus,
      started_at: undefined,
      finished_at: undefined,
      duration_ms: undefined,
      exit_code: undefined,
    };
  });
}

// GET /api/v1/projects/:slug/monitor
app.get('/', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);

  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);
  const projectFile = path.join(awRoot, 'context', 'projects', slug, 'project.json');

  let projectData: Record<string, unknown> = {};
  try {
    projectData = await readJson(projectFile) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Project not found' }, 404);
  }

  let workspaceData: Record<string, unknown> = {};
  try {
    workspaceData = await readJson(path.join(workspaceDir, 'workspace.json')) as Record<string, unknown>;
  } catch { /* workspace may not exist */ }

  const waveDirNames = await listWaveDirs(workspaceDir);
  const waveCount = waveDirNames.length;

  // Build wave history
  const waveHistory: Array<{ number: number; status: StepStatus; steps_total: number; steps_done: number; duration_ms: number | null }> = [];
  for (const wdName of waveDirNames) {
    const waveNum = parseInt(wdName.replace('wave-', ''), 10);
    const wavePath = path.join(workspaceDir, wdName);
    const steps = await buildStepList(wavePath);

    const total = steps.length;
    const done = steps.filter((s) => s!.status === 'completed').length;
    const failed = steps.filter((s) => s!.status === 'failed').length;
    const running = steps.filter((s) => s!.status === 'running').length;
    const interrupted = steps.filter((s) => s!.status === 'interrupted').length;

    let waveStatus: StepStatus = 'pending';
    if (running > 0) waveStatus = 'running';
    else if (interrupted > 0) waveStatus = 'interrupted';
    else if (failed > 0) waveStatus = 'failed';
    else if (done === total && total > 0) waveStatus = 'completed';
    else if (done > 0) waveStatus = 'running';

    const started = steps.find((s) => s!.started_at)?.started_at;
    const allFinished = steps.length > 0 && steps.every((s) => s!.finished_at);
    const lastFinished = steps.filter((s) => s!.finished_at).map((s) => new Date(s!.finished_at!).getTime()).sort((a, b) => b - a)[0];
    let duration_ms: number | null = null;
    if (started) {
      const end = allFinished && lastFinished ? lastFinished : Date.now();
      duration_ms = end - new Date(started).getTime();
    }
    waveHistory.push({ number: waveNum, status: waveStatus, steps_total: total, steps_done: done, duration_ms });
  }

  // Current wave = last wave
  const currentWaveDirName = waveDirNames[waveDirNames.length - 1];
  let currentWave: {
    number: number; status: StepStatus;
    steps: Array<{ index: number; task: string; type: string; status: StepStatus; started_at: string | null; elapsed_ms: number | null }>;
    timing: { elapsed_ms: number; estimated_remaining_ms: number | null } | null;
  } | null = null;

  let loop: { status: string; iteration: number; total: number; done: number; remaining: number; features_done: number; feature_id: string | null; current_feature: string | null } | null = null;
  let featureCounters = { passing: 0, failing: 0, skipped: 0, pending: 0, in_progress: 0, blocked: 0 };
  let features: unknown[] = [];
  let lastOutput: string[] = [];
  let activity: { last_output_age_ms: number | null; step_elapsed_ms: number | null; engine_pid: number | null; engine_alive: boolean; agent_pid: number | null; agent_alive: boolean } = {
    last_output_age_ms: null, step_elapsed_ms: null,
    engine_pid: null, engine_alive: false,
    agent_pid: null, agent_alive: false,
  };

  if (currentWaveDirName) {
    const waveNum = parseInt(currentWaveDirName.replace('wave-', ''), 10);
    const wavePath = path.join(workspaceDir, currentWaveDirName);
    const stepDirNames = await listStepDirs(wavePath);
    const steps = await buildStepList(wavePath);

    const total = steps.length;
    const done = steps.filter((s) => s!.status === 'completed').length;
    const failed = steps.filter((s) => s!.status === 'failed').length;
    const running = steps.filter((s) => s!.status === 'running').length;
    const interrupted = steps.filter((s) => s!.status === 'interrupted').length;

    let waveStatus: StepStatus = 'pending';
    if (running > 0) waveStatus = 'running';
    else if (interrupted > 0) waveStatus = 'interrupted';
    else if (failed > 0) waveStatus = 'failed';
    else if (done === total && total > 0) waveStatus = 'completed';
    else if (done > 0) waveStatus = 'running';

    const firstStarted = steps.find((s) => s!.started_at);
    let timing: { elapsed_ms: number; estimated_remaining_ms: number | null } | null = null;
    if (firstStarted?.started_at) {
      const elapsed_ms = Date.now() - new Date(firstStarted.started_at).getTime();
      const completedWithDuration = steps.filter((s) => s!.status === 'completed' && s!.duration_ms !== undefined);
      let estimated_remaining_ms: number | null = null;
      if (completedWithDuration.length > 0) {
        const avg = completedWithDuration.reduce((sum, s) => sum + (s!.duration_ms ?? 0), 0) / completedWithDuration.length;
        estimated_remaining_ms = (total - done) * avg;
      }
      timing = { elapsed_ms, estimated_remaining_ms };
    }

    currentWave = {
      number: waveNum, status: waveStatus,
      steps: steps.map((s) => ({
        index: s!.index, task: s!.task, type: s!.type, status: s!.status,
        started_at: s!.started_at ?? null,
        elapsed_ms: s!.started_at
          ? s!.finished_at
            ? new Date(s!.finished_at).getTime() - new Date(s!.started_at).getTime()
            : Date.now() - new Date(s!.started_at).getTime()
          : null,
      })),
      timing,
    };

    // Loop step
    const loopDirName = stepDirNames.find((d) => d.includes('ralph-wiggum-loop'));
    if (loopDirName) {
      try {
        const loopJson = await readJson(path.join(wavePath, loopDirName, 'loop.json')) as Record<string, unknown>;
        loop = {
          status: (loopJson['status'] as string) ?? 'unknown',
          iteration: (loopJson['iteration'] as number) ?? 0,
          total: (loopJson['total'] as number) ?? 0,
          done: (loopJson['done'] as number) ?? 0,
          remaining: (loopJson['remaining'] as number) ?? 0,
          features_done: (loopJson['features_done'] as number) ?? 0,
          feature_id: (loopJson['feature_id'] as string | null) ?? null,
          current_feature: (loopJson['current_feature'] as string | null) ?? null,
        };
      } catch { /* loop.json may not exist */ }
    }

    // Features from worktree sprint
    const sprintsDir = path.join(wavePath, 'worktree', 'sprints');
    try {
      const sprintDirs = await fs.readdir(sprintsDir);
      const latestSprint = sprintDirs
        .filter((d) => /^sprint-\d+$/.test(d))
        .sort((a, b) => parseInt(b.replace('sprint-', ''), 10) - parseInt(a.replace('sprint-', ''), 10))[0];
      if (latestSprint) {
        const rawFeatures = await readJson(path.join(sprintsDir, latestSprint, 'features.json')) as unknown[];
        features = rawFeatures;
        const fa = Array.isArray(rawFeatures) ? rawFeatures as Array<Record<string, unknown>> : [];
        featureCounters = {
          passing: fa.filter((f) => f['status'] === 'passing').length,
          failing: fa.filter((f) => f['status'] === 'failing').length,
          skipped: fa.filter((f) => f['status'] === 'skipped').length,
          pending: fa.filter((f) => f['status'] === 'pending').length,
          in_progress: fa.filter((f) => f['status'] === 'in_progress').length,
          blocked: fa.filter((f) => f['status'] === 'blocked').length,
        };
      }
    } catch { /* features may not exist */ }

    // Activity
    const activeJsonlPath = await findActiveStepJsonl(wavePath);
    if (activeJsonlPath) {
      lastOutput = await formatLastOutput(activeJsonlPath);
      activity.last_output_age_ms = await getLastOutputAge(activeJsonlPath);
    }

    const runningStep = steps.find((s) => s!.status === 'running');
    if (runningStep?.started_at) {
      activity.step_elapsed_ms = Date.now() - new Date(runningStep.started_at).getTime();
    }

    const enginePid = (workspaceData['engine_pid'] as number | undefined) ?? null;
    activity.engine_pid = enginePid;
    activity.engine_alive = enginePid !== null && isPidAlive(enginePid);

    if (runningStep) {
      const runningDirName = stepDirNames.find((d) => {
        const p = parseStepDir(d);
        return p?.index === runningStep.index;
      });
      if (runningDirName) {
        const parsed = parseStepDir(runningDirName);
        if (!parsed?.isLoop) {
          try {
            const spawnJson = await readJson(path.join(wavePath, runningDirName, 'spawn.json')) as Record<string, unknown>;
            const agentPid = (spawnJson['pid'] as number | undefined) ?? null;
            activity.agent_pid = agentPid;
            activity.agent_alive = agentPid !== null && isPidAlive(agentPid);
          } catch { /* ignore */ }
        } else if (loopDirName) {
          try {
            const loopJson = await readJson(path.join(wavePath, loopDirName, 'loop.json')) as Record<string, unknown>;
            const agentPid = (loopJson['pid'] as number | undefined) ?? null;
            activity.agent_pid = agentPid;
            activity.agent_alive = agentPid !== null && isPidAlive(agentPid);
          } catch { /* ignore */ }
        }
      }
    }
  }

  return c.json({
    project: {
      name: (projectData['name'] as string) ?? slug,
      slug: (projectData['slug'] as string) ?? slug,
      workflow: (workspaceData['workflow'] as string) ?? '',
      sprint_number: (workspaceData['sprint'] as number) ?? 1,
      wave_count: waveCount,
    },
    current_wave: currentWave,
    loop,
    feature_counters: featureCounters,
    features,
    last_output: lastOutput,
    activity,
    wave_history: waveHistory,
  });
});

export { app as monitor };

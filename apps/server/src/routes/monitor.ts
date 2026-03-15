import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from '../lib/paths.js';
import { isPidAlive } from '../lib/pid-check.js';
import {
  readJson,
  buildStepList,
  listWaveDirs,
  listStepDirs,
  parseStepDir,
  parseSpawnJsonl,
  deriveWaveStatus,
  findActiveStepJsonl,
  computeWaveTiming,
  findLatestSprintDir,
  countFeaturesByStatus,
  resolveLatestAttemptDir,
  type TimingResult,
  type StepStatus,
  type LoopJson,
} from '../lib/wave-state.js';
import { readServerRunMeta, isRunActive, type RunMode } from '../routes/runs.js';

const app = new Hono();

export interface MonitorData {
  project: {
    name: string;
    slug: string;
    workflow: string;
    sprint_number: number;
    wave_count: number;
  };
  current_wave: {
    number: number;
    status: StepStatus;
    steps: Array<{ index: number; task: string; type: string; status: StepStatus; started_at: string | null; elapsed_ms: number | null }>;
    timing: TimingResult | null;
  } | null;
  loop: { status: string; iteration: number; total: number; done: number; remaining: number; features_done: number; feature_id: string | null; current_feature: string | null } | null;
  feature_counters: { passing: number; failing: number; skipped: number; pending: number; in_progress: number; blocked: number };
  features: unknown[];
  last_output: string[];
  activity: { last_output_age_ms: number | null; step_elapsed_ms: number | null; engine_pid: number | null; engine_alive: boolean; agent_pid: number | null; agent_alive: boolean; run_mode: 'spawn' | 'detached'; run_id: string | null; run_active: boolean };
  resumable: boolean;
  wave_history: Array<{ number: number; status: StepStatus; steps_total: number; steps_done: number; duration_ms: number | null }>;
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


async function getLastOutputAge(jsonlPath: string): Promise<number | null> {
  try {
    const stat = await fs.stat(jsonlPath);
    return Date.now() - stat.mtimeMs;
  } catch { return null; }
}

export async function buildMonitorSnapshot(slug: string): Promise<MonitorData | null> {
  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);
  const projectFile = path.join(awRoot, 'context', 'projects', slug, 'project.json');

  let projectData: Record<string, unknown> = {};
  try {
    projectData = await readJson(projectFile) as Record<string, unknown>;
  } catch {
    return null;
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
    const waveStatus = deriveWaveStatus(steps);

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
  let currentWave: MonitorData['current_wave'] = null;

  let loop: MonitorData['loop'] = null;
  let featureCounters = { passing: 0, failing: 0, skipped: 0, pending: 0, in_progress: 0, blocked: 0 };
  let features: unknown[] = [];
  let lastOutput: string[] = [];
  const runMeta = await readServerRunMeta(workspaceDir);
  const runMode: RunMode = runMeta?.run_mode ?? 'detached';

  let activity: MonitorData['activity'] = {
    last_output_age_ms: null, step_elapsed_ms: null,
    engine_pid: null, engine_alive: false,
    agent_pid: null, agent_alive: false,
    run_mode: runMode,
    run_id: runMeta?.run_id ?? null,
    run_active: runMeta?.run_id ? isRunActive(runMeta.run_id) : false,
  };

  if (currentWaveDirName) {
    const waveNum = parseInt(currentWaveDirName.replace('wave-', ''), 10);
    const wavePath = path.join(workspaceDir, currentWaveDirName);
    const stepDirNames = await listStepDirs(wavePath);
    const steps = await buildStepList(wavePath);

    const waveStatus = deriveWaveStatus(steps);
    const timing = computeWaveTiming(steps);

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
        const latestAttemptDir = await resolveLatestAttemptDir(path.join(wavePath, loopDirName));
        const loopJson = await readJson(path.join(latestAttemptDir, 'loop.json')) as Record<string, unknown>;
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
    const sprintResult = await findLatestSprintDir(wavePath);
    if (sprintResult) {
      try {
        const rawFeatures = await readJson(path.join(sprintResult.sprintDir, 'features.json')) as unknown[];
        features = rawFeatures;
        const fa = Array.isArray(rawFeatures) ? rawFeatures as Array<Record<string, unknown>> : [];
        featureCounters = countFeaturesByStatus(fa);
      } catch { /* features may not exist */ }
    }

    // Activity
    const activeJsonlPath = await findActiveStepJsonl(wavePath);
    if (activeJsonlPath) {
      lastOutput = await formatLastOutput(activeJsonlPath);
      activity.last_output_age_ms = await getLastOutputAge(activeJsonlPath);
    }

    const runningStep = steps.find((s) => s!.status === 'running');
    if (runningStep?.started_at) {
      activity.step_elapsed_ms = Date.now() - new Date(runningStep.started_at).getTime();
      // last_output_age_ms cannot exceed step_elapsed_ms: if the step started 2m ago,
      // there was activity at most 2m ago — the step itself is the source of truth.
      if (activity.last_output_age_ms === null || activity.last_output_age_ms > activity.step_elapsed_ms) {
        activity.last_output_age_ms = activity.step_elapsed_ms;
      }
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
            const attemptDir = await resolveLatestAttemptDir(path.join(wavePath, runningDirName));
            const spawnJson = await readJson(path.join(attemptDir, 'spawn.json')) as Record<string, unknown>;
            const agentPid = (spawnJson['pid'] as number | undefined) ?? null;
            activity.agent_pid = agentPid;
            activity.agent_alive = agentPid !== null && isPidAlive(agentPid);
          } catch { /* ignore */ }
        } else if (loopDirName) {
          try {
            const latestAttemptDir = await resolveLatestAttemptDir(path.join(wavePath, loopDirName));
            const loopJson = await readJson(path.join(latestAttemptDir, 'loop.json')) as Record<string, unknown>;
            const agentPid = (loopJson['pid'] as number | undefined) ?? null;
            activity.agent_pid = agentPid;
            activity.agent_alive = agentPid !== null && isPidAlive(agentPid);
          } catch { /* ignore */ }
        }
      }
    }
  }

  // Read workflow-level status from workflow-state.json
  let workflowStatus: string | undefined;
  if (currentWaveDirName) {
    try {
      const wsState = await readJson(path.join(workspaceDir, currentWaveDirName, 'workflow-state.json')) as Record<string, unknown>;
      workflowStatus = wsState['status'] as string | undefined;
    } catch { /* ignore */ }
  }

  const resumable =
    !activity.engine_alive &&
    runMode === 'spawn' &&
    currentWave !== null &&
    workflowStatus !== 'completed' &&
    workflowStatus !== 'failed' &&
    currentWave.status !== 'completed' &&
    currentWave.status !== 'failed' &&
    (currentWave.steps.length === 0 ||
      currentWave.steps.some((s) => s.status === 'pending' || s.status === 'running' || s.status === 'interrupted'));

  return {
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
    resumable,
    wave_history: waveHistory,
  };
}

// GET /api/v1/projects/:slug/monitor
app.get('/', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const snapshot = await buildMonitorSnapshot(slug);
  if (!snapshot) return c.json({ error: 'Project not found' }, 404);
  return c.json(snapshot);
});

export { app as monitor };

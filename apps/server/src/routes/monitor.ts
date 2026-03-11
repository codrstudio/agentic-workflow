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
  readStepSummary,
  parseSpawnJsonl,
  type StepStatus,
  type LoopJson,
} from '../lib/wave-state.js';

const app = new Hono();

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

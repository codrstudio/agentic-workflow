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

async function findSprintDir(slug: string, waveNumber: string | number): Promise<{ sprintDir: string; sprintName: string } | null> {
  const awRoot = getAwRoot();
  const worktreeDir = path.join(awRoot, 'context', 'workspaces', String(slug), `wave-${waveNumber}`, 'worktree');
  const sprintsDir = path.join(worktreeDir, 'sprints');
  let sprintDirs: string[];
  try {
    sprintDirs = await fs.readdir(sprintsDir);
  } catch {
    return null;
  }
  const latestSprint = sprintDirs
    .filter(d => /^sprint-\d+$/.test(d))
    .sort((a, b) => parseInt(b.replace('sprint-', ''), 10) - parseInt(a.replace('sprint-', ''), 10))[0];
  if (!latestSprint) return null;
  return { sprintDir: path.join(sprintsDir, latestSprint), sprintName: latestSprint };
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
  max_iterations?: number | null;
  max_features?: number | null;
  exit_reason?: string;
}

type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'interrupted';

function deriveStatus(spawn: SpawnJson | null, dirExists: boolean): StepStatus {
  if (!dirExists) return 'pending';
  if (!spawn) return 'running';
  if (spawn.exit_code === undefined || spawn.exit_code === null) {
    // Process started but not finished — check if PID is still alive
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
    try {
      loop = await readJson(loopFile) as LoopJson;
    } catch {
      // loop.json may not exist yet
    }

    let status: StepStatus = 'running';
    if (!loop) {
      status = 'running';
    } else if (loop.status === 'exited') {
      // Engine writes status='exited' with exit_reason to indicate outcome
      const reason = loop.exit_reason ?? '';
      const isError = reason.startsWith('error:');
      status = isError ? 'failed' : 'completed';
    } else if (loop.status === 'starting' || loop.status === 'running' || loop.status === 'between') {
      // Active states — check if PID is still alive
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

interface TimingResult {
  started_at: string;
  elapsed_ms: number;
  completed_steps_avg_ms: number;
  completed_steps_total_ms: number;
  remaining_steps: number;
  estimated_remaining_ms: number;
  estimated_completion: string;
}

function computeTiming(steps: Array<{
  status: StepStatus;
  started_at?: string;
  finished_at?: string;
  duration_ms?: number;
}>): TimingResult | null {
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
  const remaining_steps = steps.length - completed;
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

async function listWaveDirs(workspaceDir: string): Promise<string[]> {
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

async function listStepDirs(waveDir: string): Promise<string[]> {
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

type StepSummary = NonNullable<Awaited<ReturnType<typeof readStepSummary>>>;

async function buildStepList(wavePath: string): Promise<StepSummary[]> {
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

// GET /api/v1/projects/:slug/waves
app.get('/', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);

  const waveDirs = await listWaveDirs(workspaceDir);

  const waves = await Promise.all(
    waveDirs.map(async (waveDir) => {
      const waveNumber = parseInt(waveDir.replace('wave-', ''), 10);
      const wavePath = path.join(workspaceDir, waveDir);
      const steps = await buildStepList(wavePath);

      const total = steps.length;
      const completed = steps.filter((s) => s.status === 'completed').length;
      const failed = steps.filter((s) => s.status === 'failed').length;
      const running = steps.filter((s) => s.status === 'running').length;
      const interrupted = steps.filter((s) => s.status === 'interrupted').length;

      let waveStatus: StepStatus = 'pending';
      if (running > 0) waveStatus = 'running';
      else if (interrupted > 0) waveStatus = 'interrupted';
      else if (failed > 0) waveStatus = 'failed';
      else if (completed === total && total > 0) waveStatus = 'completed';
      else if (completed > 0) waveStatus = 'running';

      return {
        wave_number: waveNumber,
        status: waveStatus,
        steps_total: total,
        steps_completed: completed,
        steps_failed: failed,
        steps: steps,
      };
    })
  );

  return c.json(waves);
});

// GET /api/v1/projects/:slug/waves/:waveNumber
app.get('/:waveNumber', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const waveNumber = parseInt(c.req.param('waveNumber') ?? '', 10);

  if (isNaN(waveNumber)) {
    return c.json({ error: 'Invalid wave number' }, 400);
  }

  const awRoot = getAwRoot();
  const waveDir = path.join(awRoot, 'context', 'workspaces', slug, `wave-${waveNumber}`);

  try {
    await fs.access(waveDir);
  } catch {
    return c.json({ error: 'Wave not found' }, 404);
  }

  const steps = await buildStepList(waveDir);

  const total = steps.length;
  const completed = steps.filter((s) => s.status === 'completed').length;
  const failed = steps.filter((s) => s.status === 'failed').length;
  const running = steps.filter((s) => s.status === 'running').length;
  const interrupted = steps.filter((s) => s.status === 'interrupted').length;

  let waveStatus: StepStatus = 'pending';
  if (running > 0) waveStatus = 'running';
  else if (interrupted > 0) waveStatus = 'interrupted';
  else if (failed > 0) waveStatus = 'failed';
  else if (completed === total && total > 0) waveStatus = 'completed';
  else if (completed > 0) waveStatus = 'running';

  const timing = computeTiming(steps);

  return c.json({
    wave_number: waveNumber,
    status: waveStatus,
    steps_total: total,
    steps_completed: completed,
    steps_failed: failed,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    steps: steps,
    timing,
  });
});

// GET /api/v1/projects/:slug/waves/:waveNumber/loop
app.get('/:waveNumber/loop', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const waveNumber = parseInt(c.req.param('waveNumber') ?? '', 10);

  if (isNaN(waveNumber)) {
    return c.json({ error: 'Invalid wave number' }, 400);
  }

  const awRoot = getAwRoot();
  const waveDir = path.join(awRoot, 'context', 'workspaces', slug, `wave-${waveNumber}`);

  try {
    await fs.access(waveDir);
  } catch {
    return c.json({ error: 'Wave not found' }, 404);
  }

  // Find the ralph-wiggum-loop step directory
  const stepDirs = await listStepDirs(waveDir);
  const loopStepDir = stepDirs.find((d) => d.includes('ralph-wiggum-loop'));

  if (!loopStepDir) {
    return c.json({ error: 'No loop step found in this wave' }, 404);
  }

  const loopStepPath = path.join(waveDir, loopStepDir);

  // Read loop.json
  let loop: LoopJson | null = null;
  try {
    loop = await readJson(path.join(loopStepPath, 'loop.json')) as LoopJson;
  } catch {
    return c.json({ error: 'Loop state not available yet' }, 404);
  }

  // Try to find features.json — check wave worktree or repo sprints
  let features: unknown[] = [];
  const sprint = await findSprintDir(slug, waveNumber);
  try {
    if (sprint) {
      const featuresFile = path.join(sprint.sprintDir, 'features.json');
      features = await readJson(featuresFile) as unknown[];
    }
  } catch {
    // features.json may not be accessible
  }

  // Compute feature counters from features array
  const featureArr = Array.isArray(features) ? features as Array<Record<string, unknown>> : [];
  const counters = {
    passing: featureArr.filter((f) => f['status'] === 'passing').length,
    failing: featureArr.filter((f) => f['status'] === 'failing').length,
    skipped: featureArr.filter((f) => f['status'] === 'skipped').length,
    pending: featureArr.filter((f) => f['status'] === 'pending').length,
    blocked: featureArr.filter((f) => f['status'] === 'blocked').length,
    in_progress: featureArr.filter((f) => f['status'] === 'in_progress').length,
  };

  // Enrich features with prp_filename
  const enrichedFeatures = (Array.isArray(features) ? features as Array<Record<string, unknown>> : []).map((f) => {
    const prpPath = f['prp_path'] as string | undefined;
    if (prpPath) {
      return { ...f, prp_filename: path.basename(prpPath) };
    }
    return f;
  });

  return c.json({
    loop,
    features: enrichedFeatures,
    counters,
  });
});

type LogLineType = 'system' | 'assistant' | 'tool_use' | 'tool_result' | 'user';

interface ParsedLogLine {
  index: number;
  type: LogLineType;
  raw: unknown;
}

function classifyLine(obj: Record<string, unknown>): LogLineType {
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

async function parseSpawnJsonl(jsonlPath: string): Promise<ParsedLogLine[]> {
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

async function findStepDir(waveDir: string, stepIndex: number): Promise<string | null> {
  const stepDirs = await listStepDirs(waveDir);
  const match = stepDirs.find((d) => {
    const parsed = parseStepDir(d);
    return parsed?.index === stepIndex;
  });
  return match ?? null;
}

// GET /api/v1/projects/:slug/waves/:waveNumber/steps/:stepIndex
app.get('/:waveNumber/steps/:stepIndex', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const waveNumber = parseInt(c.req.param('waveNumber') ?? '', 10);
  const stepIndex = parseInt(c.req.param('stepIndex') ?? '', 10);

  if (isNaN(waveNumber) || isNaN(stepIndex)) {
    return c.json({ error: 'Invalid wave number or step index' }, 400);
  }

  const awRoot = getAwRoot();
  const waveDir = path.join(awRoot, 'context', 'workspaces', slug, `wave-${waveNumber}`);

  try {
    await fs.access(waveDir);
  } catch {
    return c.json({ error: 'Wave not found' }, 404);
  }

  const stepDirName = await findStepDir(waveDir, stepIndex);
  if (!stepDirName) return c.json({ error: 'Step not found' }, 404);

  const stepDir = path.join(waveDir, stepDirName);
  const parsed = parseStepDir(stepDirName);

  // ralph-wiggum-loop steps use loop.json instead of spawn.json
  if (parsed?.isLoop) {
    const loopFile = path.join(stepDir, 'loop.json');
    let loop: LoopJson | null = null;
    try {
      loop = await readJson(loopFile) as LoopJson;
    } catch {
      return c.json({ error: 'Step metadata not available yet' }, 404);
    }

    let status: StepStatus = 'running';
    if (loop.status === 'exited') {
      const reason = loop.exit_reason ?? '';
      status = reason.startsWith('error:') ? 'failed' : 'completed';
    } else if (loop.status === 'starting' || loop.status === 'running' || loop.status === 'between') {
      if (loop.pid !== undefined && loop.pid !== null) {
        status = isPidAlive(loop.pid) ? 'running' : 'interrupted';
      }
    }

    let duration_ms: number | undefined;
    if (loop.started_at && loop.updated_at) {
      duration_ms = new Date(loop.updated_at).getTime() - new Date(loop.started_at).getTime();
    }

    // List feature attempt directories
    const attemptDirs: string[] = [];
    try {
      const entries = await fs.readdir(stepDir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory() && /^F-\d+-attempt-\d+$/.test(e.name)) {
          attemptDirs.push(e.name);
        }
      }
      attemptDirs.sort();
    } catch {
      // ignore
    }

    // Read spawn.json for each attempt
    const attempts: Array<{
      dir: string;
      feature: string;
      attempt: number;
      task?: string;
      agent?: string;
      pid?: number;
      started_at?: string;
      finished_at?: string;
      exit_code?: number;
      timed_out?: boolean;
      model_used?: string;
      status: StepStatus;
      duration_ms?: number;
    }> = [];
    for (const aDir of attemptDirs) {
      const aSpawnFile = path.join(stepDir, aDir, 'spawn.json');
      try {
        const aSpawn = await readJson(aSpawnFile) as SpawnJson & { feature?: string; attempt?: number };
        const aStatus = deriveStatus(aSpawn, true);
        let aDuration: number | undefined;
        if (aSpawn.started_at && aSpawn.finished_at) {
          aDuration = new Date(aSpawn.finished_at).getTime() - new Date(aSpawn.started_at).getTime();
        }
        attempts.push({
          dir: aDir,
          feature: aSpawn.feature ?? aDir.replace(/-attempt-\d+$/, ''),
          attempt: aSpawn.attempt ?? 1,
          task: aSpawn.task,
          agent: aSpawn.agent,
          pid: aSpawn.pid,
          started_at: aSpawn.started_at,
          finished_at: aSpawn.finished_at,
          exit_code: aSpawn.exit_code,
          timed_out: aSpawn.timed_out,
          model_used: aSpawn.model_used,
          status: aStatus,
          duration_ms: aDuration,
        });
      } catch {
        // spawn.json not available yet for this attempt
        attempts.push({
          dir: aDir,
          feature: aDir.replace(/-attempt-\d+$/, ''),
          attempt: parseInt(aDir.match(/-attempt-(\d+)$/)?.[1] ?? '1', 10),
          status: 'running',
        });
      }
    }

    return c.json({
      index: stepIndex,
      dir: stepDirName,
      task: parsed.task,
      type: 'ralph-wiggum-loop',
      pid: loop.pid,
      started_at: loop.started_at,
      finished_at: loop.updated_at,
      exit_code: status === 'completed' ? 0 : status === 'failed' ? 1 : undefined,
      status,
      duration_ms,
      // loop-specific fields
      iteration: loop.iteration,
      total: loop.total,
      done: loop.done,
      remaining: loop.remaining,
      features_done: loop.features_done,
      exit_reason: loop.exit_reason,
      attempts,
    });
  }

  // Regular step — read spawn.json
  const spawnFile = path.join(stepDir, 'spawn.json');

  let spawn: SpawnJson | null = null;
  try {
    spawn = await readJson(spawnFile) as SpawnJson;
  } catch {
    return c.json({ error: 'Step metadata not available yet' }, 404);
  }

  const status = deriveStatus(spawn, true);
  let duration_ms: number | undefined;
  if (spawn.started_at && spawn.finished_at) {
    duration_ms = new Date(spawn.finished_at).getTime() - new Date(spawn.started_at).getTime();
  }

  return c.json({
    index: stepIndex,
    dir: stepDirName,
    task: spawn.task,
    agent: spawn.agent,
    wave: spawn.wave,
    step: spawn.step,
    pid: spawn.pid,
    parent_pid: spawn.parent_pid,
    started_at: spawn.started_at,
    finished_at: spawn.finished_at,
    exit_code: spawn.exit_code,
    timed_out: spawn.timed_out,
    model_used: spawn.model_used,
    status,
    duration_ms,
  });
});

// GET /api/v1/projects/:slug/waves/:waveNumber/steps/:stepIndex/log
app.get('/:waveNumber/steps/:stepIndex/log', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const waveNumber = parseInt(c.req.param('waveNumber') ?? '', 10);
  const stepIndex = parseInt(c.req.param('stepIndex') ?? '', 10);

  if (isNaN(waveNumber) || isNaN(stepIndex)) {
    return c.json({ error: 'Invalid wave number or step index' }, 400);
  }

  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0', 10) || 0);
  const limit = Math.min(500, Math.max(1, parseInt(c.req.query('limit') ?? '100', 10) || 100));

  const awRoot = getAwRoot();
  const waveDir = path.join(awRoot, 'context', 'workspaces', slug, `wave-${waveNumber}`);

  try {
    await fs.access(waveDir);
  } catch {
    return c.json({ error: 'Wave not found' }, 404);
  }

  const stepDirName = await findStepDir(waveDir, stepIndex);
  if (!stepDirName) return c.json({ error: 'Step not found' }, 404);

  const stepDir = path.join(waveDir, stepDirName);
  const parsed = parseStepDir(stepDirName);

  // For loop steps, check if a specific attempt is requested via query param
  if (parsed?.isLoop) {
    const attemptDir = c.req.query('attempt');
    if (!attemptDir) {
      // No attempt specified — return empty (frontend shows attempts list instead)
      return c.json({ total: 0, offset: 0, limit, lines: [] });
    }
    // Validate attempt dir name to prevent path traversal
    if (!/^F-\d+-attempt-\d+$/.test(attemptDir)) {
      return c.json({ error: 'Invalid attempt directory' }, 400);
    }
    const jsonlFile = path.join(stepDir, attemptDir, 'spawn.jsonl');
    const allLines = await parseSpawnJsonl(jsonlFile);
    const total = allLines.length;
    const page = allLines.slice(offset, offset + limit);
    return c.json({ total, offset, limit, lines: page });
  }

  const jsonlFile = path.join(stepDir, 'spawn.jsonl');

  const allLines = await parseSpawnJsonl(jsonlFile);
  const total = allLines.length;
  const page = allLines.slice(offset, offset + limit);

  return c.json({
    total,
    offset,
    limit,
    lines: page,
  });
});

// GET /api/v1/projects/:slug/waves/:waveNumber/sprint/files
app.get('/:waveNumber/sprint/files', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const waveNumber = c.req.param('waveNumber') ?? '';
  if (!/^\d+$/.test(waveNumber)) return c.json({ error: 'Invalid wave number' }, 400);

  const sprint = await findSprintDir(slug, waveNumber);
  if (!sprint) return c.json({ error: 'Sprint not found' }, 404);

  const specs: Array<{ filename: string; size: number }> = [];
  const prps: Array<{ filename: string; size: number }> = [];

  // Read 2-specs/
  try {
    const specsDir = path.join(sprint.sprintDir, '2-specs');
    const entries = await fs.readdir(specsDir);
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const stat = await fs.stat(path.join(specsDir, entry));
        specs.push({ filename: entry, size: stat.size });
      }
    }
  } catch {
    // directory may not exist
  }

  // Read 3-prps/
  try {
    const prpsDir = path.join(sprint.sprintDir, '3-prps');
    const entries = await fs.readdir(prpsDir);
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const stat = await fs.stat(path.join(prpsDir, entry));
        prps.push({ filename: entry, size: stat.size });
      }
    }
  } catch {
    // directory may not exist
  }

  return c.json({ sprint: sprint.sprintName, specs, prps });
});

// GET /api/v1/projects/:slug/waves/:waveNumber/sprint/files/:filename
app.get('/:waveNumber/sprint/files/:filename', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const waveNumber = c.req.param('waveNumber') ?? '';
  if (!/^\d+$/.test(waveNumber)) return c.json({ error: 'Invalid wave number' }, 400);

  const filename = c.req.param('filename') ?? '';

  // Validate filename format
  if (!/^(S|PRP)-\d{3}[a-zA-Z0-9_-]*\.md$/.test(filename)) {
    return c.json({ error: 'Invalid filename format' }, 400);
  }

  const sprint = await findSprintDir(slug, waveNumber);
  if (!sprint) return c.json({ error: 'Sprint not found' }, 404);

  // Determine subdirectory based on prefix
  const subdir = filename.startsWith('S-') ? '2-specs' : '3-prps';
  const filePath = path.resolve(sprint.sprintDir, subdir, filename);

  // Path traversal protection
  if (!filePath.startsWith(sprint.sprintDir)) {
    return c.json({ error: 'Invalid filename' }, 400);
  }

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return c.json({ filename, content });
  } catch {
    return c.json({ error: 'File not found' }, 404);
  }
});

// GET /api/v1/projects/:slug/waves/:waveNumber/conversation
app.get('/:waveNumber/conversation', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);
  const waveNumber = parseInt(c.req.param('waveNumber') ?? '', 10);

  if (isNaN(waveNumber)) {
    return c.json({ error: 'Invalid wave number' }, 400);
  }

  const awRoot = getAwRoot();
  const logPath = path.join(awRoot, 'context', 'workspaces', slug, `wave-${waveNumber}`, 'operator-log.jsonl');
  const queuePath = path.join(awRoot, 'context', 'workspaces', slug, 'operator-queue.jsonl');

  interface ConversationEntry {
    role: 'user' | 'engine';
    id?: string;
    timestamp: string;
    message?: string;
    source?: string;
    event?: string;
    data?: Record<string, unknown>;
    drain?: number;
    pending?: boolean;
  }

  const entries: ConversationEntry[] = [];

  // 1. Read log (already processed messages + engine events)
  try {
    const logContent = await fs.readFile(logPath, 'utf-8');
    for (const line of logContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const entry = JSON.parse(trimmed) as ConversationEntry;
        entries.push(entry);
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // log file may not exist yet
  }

  // 2. Read queue (pending messages not yet consumed by engine)
  try {
    const queueContent = await fs.readFile(queuePath, 'utf-8');
    const loggedIds = new Set(entries.filter((e) => e.role === 'user' && e.id).map((e) => e.id));
    for (const line of queueContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as { id?: string; timestamp?: string; message?: string; source?: string };
        // Only add if not already in the log (avoid duplicates)
        if (msg.id && !loggedIds.has(msg.id)) {
          entries.push({
            role: 'user',
            id: msg.id,
            timestamp: msg.timestamp ?? new Date().toISOString(),
            message: msg.message,
            source: msg.source,
            pending: true,
          });
        }
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // queue file may not exist
  }

  // Sort by timestamp
  entries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return c.json(entries);
});

export { app as waves };

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from '../lib/paths.js';

const app = new Hono();

async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as unknown;
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
}

type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

function deriveStatus(spawn: SpawnJson | null, dirExists: boolean): StepStatus {
  if (!dirExists) return 'pending';
  if (!spawn) return 'running';
  if (spawn.exit_code === undefined || spawn.exit_code === null) return 'running';
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
    } else if (loop.status === 'completed') {
      status = 'completed';
    } else if (loop.status === 'failed') {
      status = 'failed';
    } else {
      status = 'running';
    }

    return {
      index: parsed.index,
      task: parsed.task,
      type: 'ralph-wiggum-loop',
      status,
      started_at: loop?.started_at,
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
      const stepDirs = await listStepDirs(wavePath);

      const steps = (
        await Promise.all(stepDirs.map((d) => readStepSummary(wavePath, d)))
      ).filter(Boolean);

      const total = steps.length;
      const completed = steps.filter((s) => s!.status === 'completed').length;
      const failed = steps.filter((s) => s!.status === 'failed').length;
      const running = steps.filter((s) => s!.status === 'running').length;

      let waveStatus: StepStatus = 'pending';
      if (running > 0) waveStatus = 'running';
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

  const stepDirs = await listStepDirs(waveDir);
  const steps = (
    await Promise.all(stepDirs.map((d) => readStepSummary(waveDir, d)))
  ).filter(Boolean);

  const total = steps.length;
  const completed = steps.filter((s) => s!.status === 'completed').length;
  const failed = steps.filter((s) => s!.status === 'failed').length;
  const running = steps.filter((s) => s!.status === 'running').length;

  let waveStatus: StepStatus = 'pending';
  if (running > 0) waveStatus = 'running';
  else if (failed > 0) waveStatus = 'failed';
  else if (completed === total && total > 0) waveStatus = 'completed';
  else if (completed > 0) waveStatus = 'running';

  return c.json({
    wave_number: waveNumber,
    status: waveStatus,
    steps_total: total,
    steps_completed: completed,
    steps_failed: failed,
    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    steps: steps,
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
  const worktreeDir = path.join(awRoot, 'context', 'workspaces', slug, `wave-${waveNumber}`, 'worktree');
  let features: unknown[] = [];
  try {
    const sprintsDir = path.join(worktreeDir, 'sprints');
    const sprintDirs = await fs.readdir(sprintsDir);
    // Use the latest sprint
    const latestSprint = sprintDirs
      .filter((d) => /^sprint-\d+$/.test(d))
      .sort((a, b) => {
        const na = parseInt(a.replace('sprint-', ''), 10);
        const nb = parseInt(b.replace('sprint-', ''), 10);
        return nb - na;
      })[0];

    if (latestSprint) {
      const featuresFile = path.join(sprintsDir, latestSprint, 'features.json');
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

  return c.json({
    loop,
    features,
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

export { app as waves };

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from '../lib/paths.js';
import { isPidAlive } from '../lib/pid-check.js';
import {
  readJson,
  resolveLatestAttemptDir,
  buildStepList,
  listWaveDirs,
  listStepDirs,
  parseStepDir,
  deriveStatus,
  deriveWaveStatus,
  parseSpawnJsonl,
  computeWaveTiming,
  findLatestSprintDir,
  countFeaturesByStatus,
  type StepStatus,
  type LoopJson,
  type SpawnJson,
} from '../lib/wave-state.js';

const app = new Hono();


async function findStepDir(waveDir: string, stepIndex: number): Promise<string | null> {
  const stepDirs = await listStepDirs(waveDir);
  const match = stepDirs.find((d) => {
    const parsed = parseStepDir(d);
    return parsed?.index === stepIndex;
  });
  return match ?? null;
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
      const waveStatus = deriveWaveStatus(steps);

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
  const waveStatus = deriveWaveStatus(steps);
  const timing = computeWaveTiming(steps);

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

  // Read loop.json from latest attempt-N subdir
  let loop: LoopJson | null = null;
  try {
    const latestAttemptDir = await resolveLatestAttemptDir(loopStepPath);
    loop = await readJson(path.join(latestAttemptDir, 'loop.json')) as LoopJson;
  } catch {
    return c.json({ error: 'Loop state not available yet' }, 404);
  }

  // Try to find features.json — check wave worktree or repo sprints
  let features: unknown[] = [];
  const sprint = await findLatestSprintDir(waveDir);
  try {
    if (sprint) {
      features = await readJson(path.join(sprint.sprintDir, 'features.json')) as unknown[];
    }
  } catch {
    // features.json may not be accessible
  }

  const featureArr = Array.isArray(features) ? features as Array<Record<string, unknown>> : [];
  const counters = countFeaturesByStatus(featureArr);

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

  // ralph-wiggum-loop steps use loop.json inside latest attempt-N subdir
  if (parsed?.isLoop) {
    let loop: LoopJson | null = null;
    try {
      const latestAttemptDir = await resolveLatestAttemptDir(stepDir);
      loop = await readJson(path.join(latestAttemptDir, 'loop.json')) as LoopJson;
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

    // List feature attempt directories (inside latest attempt-N subdir)
    const loopAttemptDir = await resolveLatestAttemptDir(stepDir);
    const attemptDirs: string[] = [];
    try {
      const entries = await fs.readdir(loopAttemptDir, { withFileTypes: true });
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
      const aSpawnFile = path.join(loopAttemptDir, aDir, 'spawn.json');
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

  // Regular step — list attempt-N/ subdirs and read latest spawn.json
  const regularAttemptDirs: string[] = [];
  try {
    const entries = await fs.readdir(stepDir, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && /^attempt-\d+$/.test(e.name)) {
        regularAttemptDirs.push(e.name);
      }
    }
    regularAttemptDirs.sort((a, b) => {
      const na = parseInt(a.replace('attempt-', ''), 10);
      const nb = parseInt(b.replace('attempt-', ''), 10);
      return na - nb;
    });
  } catch {
    // ignore
  }

  let spawn: SpawnJson | null = null;
  try {
    // Read from latest attempt dir; resolveLatestAttemptDir falls back to stepDir for legacy steps
    const latestDir = await resolveLatestAttemptDir(stepDir);
    spawn = await readJson(path.join(latestDir, 'spawn.json')) as SpawnJson;
  } catch {
    return c.json({ error: 'Step metadata not available yet' }, 404);
  }

  const status = deriveStatus(spawn, true);
  let duration_ms: number | undefined;
  if (spawn.started_at && spawn.finished_at) {
    duration_ms = new Date(spawn.finished_at).getTime() - new Date(spawn.started_at).getTime();
  }

  // Build attempts array from attempt-N/ subdirs
  const regularAttempts: Array<{
    dir: string;
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
  for (const aDir of regularAttemptDirs) {
    const aSpawnFile = path.join(stepDir, aDir, 'spawn.json');
    try {
      const aSpawn = await readJson(aSpawnFile) as SpawnJson & { attempt?: number };
      const aStatus = deriveStatus(aSpawn, true);
      let aDuration: number | undefined;
      if (aSpawn.started_at && aSpawn.finished_at) {
        aDuration = new Date(aSpawn.finished_at).getTime() - new Date(aSpawn.started_at).getTime();
      }
      regularAttempts.push({
        dir: aDir,
        attempt: aSpawn.attempt ?? parseInt(aDir.replace('attempt-', ''), 10),
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
      regularAttempts.push({
        dir: aDir,
        attempt: parseInt(aDir.replace('attempt-', ''), 10),
        status: 'running',
      });
    }
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
    attempts: regularAttempts,
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

  const attemptQuery = c.req.query('attempt');

  // For loop steps, a specific attempt dir (F-XXX-attempt-N) must be provided
  if (parsed?.isLoop) {
    if (!attemptQuery) {
      // No attempt specified — return empty (frontend shows attempts list instead)
      return c.json({ total: 0, offset: 0, limit, lines: [] });
    }
    // Validate attempt dir name to prevent path traversal (loop feature attempts)
    if (!/^F-\d+-attempt-\d+$/.test(attemptQuery)) {
      return c.json({ error: 'Invalid attempt directory' }, 400);
    }
    const loopLogAttemptDir = await resolveLatestAttemptDir(stepDir);
    const jsonlFile = path.join(loopLogAttemptDir, attemptQuery, 'spawn.jsonl');
    const allLines = await parseSpawnJsonl(jsonlFile);
    const total = allLines.length;
    const page = allLines.slice(offset, offset + limit);
    return c.json({ total, offset, limit, lines: page });
  }

  // Regular step — resolve log path from attempt dir
  let logDir: string;
  if (attemptQuery) {
    // Validate attempt dir name to prevent path traversal (regular attempts)
    if (!/^attempt-\d+$/.test(attemptQuery)) {
      return c.json({ error: 'Invalid attempt directory' }, 400);
    }
    logDir = path.join(stepDir, attemptQuery);
  } else {
    // Default to latest attempt (or stepDir itself for legacy steps)
    logDir = await resolveLatestAttemptDir(stepDir);
  }

  const jsonlFile = path.join(logDir, 'spawn.jsonl');

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

  const sprint = await findLatestSprintDir(path.join(getAwRoot(), 'context', 'workspaces', slug, `wave-${waveNumber}`));
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

  const sprint = await findLatestSprintDir(path.join(getAwRoot(), 'context', 'workspaces', slug, `wave-${waveNumber}`));
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

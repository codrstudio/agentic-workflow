import { Hono } from 'hono';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

type RunStatus = 'running' | 'completed' | 'failed';

interface Run {
  id: string;
  slug: string;
  workflow: string;
  pid: number;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
}

const runs = new Map<string, Run>();

function getAwRoot(): string {
  return process.env['AW_ROOT'] ?? process.cwd();
}

const app = new Hono();

// POST /api/v1/projects/:slug/runs
app.post('/', async (c) => {
  const slug = c.req.param('slug') ?? c.req.param('slug');
  if (!slug) {
    return c.json({ error: 'Project slug is required' }, 400);
  }

  const body = await c.req.json<{ workflow: string }>();
  const { workflow } = body;

  if (!workflow) {
    return c.json({ error: 'workflow is required' }, 400);
  }

  const awRoot = getAwRoot();
  const cliPath = path.join(awRoot, 'apps', 'engine', 'dist', 'cli.js');

  const child: ChildProcess = spawn('node', [cliPath, slug, workflow], {
    cwd: awRoot,
    env: { ...process.env },
    stdio: ['ignore', 'ignore', 'ignore'],
    detached: false,
  });

  if (child.pid === undefined) {
    return c.json({ error: 'Failed to spawn engine process' }, 500);
  }

  const pid = child.pid;
  const runId = randomUUID();
  const run: Run = {
    id: runId,
    slug,
    workflow,
    pid,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  runs.set(runId, run);

  child.on('exit', (code: number | null) => {
    const r = runs.get(runId);
    if (r) {
      r.status = code === 0 ? 'completed' : 'failed';
      if (code !== null) r.exitCode = code;
      r.completedAt = new Date().toISOString();
    }
  });

  return c.json({ runId, pid }, 201);
});

// GET /api/v1/projects/:slug/runs
app.get('/', (c) => {
  const slug = c.req.param('slug');
  const result = [...runs.values()].filter((r) => r.slug === slug);
  return c.json(result);
});

// DELETE /api/v1/projects/:slug/runs/:runId
app.delete('/:runId', (c) => {
  const runId = c.req.param('runId');
  const run = runs.get(runId);

  if (!run) {
    return c.json({ error: 'Run not found' }, 404);
  }

  if (run.status !== 'running') {
    return c.json({ error: 'Run is not active' }, 409);
  }

  try {
    process.kill(run.pid, 'SIGTERM');
  } catch {
    return c.json({ error: 'Failed to send SIGTERM' }, 500);
  }

  return c.json({ ok: true });
});

export { app as runs };

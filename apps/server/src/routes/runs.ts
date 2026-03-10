import { Hono } from 'hono';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import readline from 'node:readline';
import { eventBus } from '../lib/event-bus.js';
import { getAwRoot } from '../lib/paths.js';

export type RunStatus = 'running' | 'completed' | 'failed';

export interface Run {
  id: string;
  slug: string;
  workflow: string;
  pid: number;
  status: RunStatus;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
}

export const runsStore = new Map<string, Run>();

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
    stdio: ['ignore', 'pipe', 'ignore'],
    detached: false,
  });

  if (child.pid === undefined) {
    return c.json({ error: 'Failed to spawn engine process' }, 500);
  }

  const pid = child.pid;
  const runId = randomUUID();

  // Capture engine stdout (JSONL events) and emit to SSE bus
  if (child.stdout) {
    const rl = readline.createInterface({ input: child.stdout });
    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const parsed: unknown = JSON.parse(trimmed);
        eventBus.broadcast({
          type: 'engine:event',
          data: { runId, slug, payload: parsed },
          timestamp: new Date().toISOString(),
        });
      } catch {
        // non-JSON output — emit as raw log line
        eventBus.broadcast({
          type: 'engine:log',
          data: { runId, slug, line: trimmed },
          timestamp: new Date().toISOString(),
        });
      }
    });
  }
  const run: Run = {
    id: runId,
    slug,
    workflow,
    pid,
    status: 'running',
    startedAt: new Date().toISOString(),
  };
  runsStore.set(runId, run);

  eventBus.broadcast({
    type: 'run:started',
    data: { runId, slug, workflow, pid },
    timestamp: new Date().toISOString(),
  });

  child.on('exit', (code: number | null) => {
    const r = runsStore.get(runId);
    if (r) {
      r.status = code === 0 ? 'completed' : 'failed';
      if (code !== null) r.exitCode = code;
      r.completedAt = new Date().toISOString();
      eventBus.broadcast({
        type: code === 0 ? 'run:completed' : 'run:failed',
        data: { runId, slug, exitCode: code },
        timestamp: new Date().toISOString(),
      });
    }
  });

  return c.json({ runId, pid }, 201);
});

// GET /api/v1/projects/:slug/runs
app.get('/', (c) => {
  const slug = c.req.param('slug');
  const result = [...runsStore.values()].filter((r) => r.slug === slug);
  return c.json(result);
});

// DELETE /api/v1/projects/:slug/runs/:runId
app.delete('/:runId', (c) => {
  const runId = c.req.param('runId');
  const run = runsStore.get(runId);

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

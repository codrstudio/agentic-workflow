import { Hono } from 'hono';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promises as fs, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { eventBus } from '../lib/event-bus.js';
import { getAwRoot } from '../lib/paths.js';
import { listWaveDirs } from '../lib/wave-state.js';

export type RunStatus = 'running' | 'completed' | 'failed';
export type RunMode = 'spawn' | 'detached';

export interface Run {
  id: string;
  slug: string;
  workflow: string;
  pid: number;
  status: RunStatus;
  mode: RunMode;
  startedAt: string;
  completedAt?: string;
  exitCode?: number;
  intentionalStop?: boolean;
  retryCount?: number;
}

export interface ServerRunMeta {
  run_mode: RunMode;
  run_id: string;
  started_at: string;
}

const MAX_RETRIES = 3;

export const runsStore = new Map<string, Run>();

export async function readServerRunMeta(workspaceDir: string): Promise<ServerRunMeta | null> {
  try {
    const raw = await fs.readFile(path.join(workspaceDir, 'server-run.json'), 'utf-8');
    return JSON.parse(raw) as ServerRunMeta;
  } catch {
    return null;
  }
}

async function writeServerRunMeta(workspaceDir: string, meta: ServerRunMeta): Promise<void> {
  await fs.mkdir(workspaceDir, { recursive: true });
  const tmp = path.join(workspaceDir, 'server-run.json.tmp');
  await fs.writeFile(tmp, JSON.stringify(meta, null, 2));
  await fs.rename(tmp, path.join(workspaceDir, 'server-run.json'));
}

function spawnEngineChild(
  awRoot: string,
  cliPath: string,
  slug: string,
  workflow: string,
): ChildProcess {
  return spawn('node', [cliPath, slug, workflow], {
    cwd: awRoot,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'ignore'],
    detached: false,
  });
}

export function attachEngineHandlers(
  child: ChildProcess,
  runId: string,
  slug: string,
  workflow: string,
  awRoot: string,
  cliPath: string,
): void {
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
        eventBus.broadcast({
          type: 'engine:log',
          data: { runId, slug, line: trimmed },
          timestamp: new Date().toISOString(),
        });
      }
    });
  }

  child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
    const r = runsStore.get(runId);
    if (!r) return;

    // User clicked "Stop" — persist stopped state so resume won't revive this workflow
    if (r.intentionalStop) {
      markWorkflowStopped(slug);
    }

    const externalSigterm = signal === 'SIGTERM' && !r.intentionalStop;
    const crashed = (code !== 0 || externalSigterm) && !r.intentionalStop;
    if (crashed) {
      const retryCount = (r.retryCount ?? 0) + 1;
      const crashMessage = externalSigterm
        ? 'Engine killed by external SIGTERM (not intentional stop)'
        : `Engine exited with code ${code}${signal ? ` (signal: ${signal})` : ''}`;

      eventBus.broadcast({
        type: 'run:crash',
        data: { runId, slug, exitCode: code, signal, retryCount, maxRetries: MAX_RETRIES, message: crashMessage },
        timestamp: new Date().toISOString(),
      });

      writeServerCrashReport(slug, crashMessage, code, signal).catch(() => {});

      if (retryCount <= MAX_RETRIES) {
        r.retryCount = retryCount;
        const newChild = spawnEngineChild(awRoot, cliPath, slug, workflow);
        if (newChild.pid !== undefined) {
          r.pid = newChild.pid;
          attachEngineHandlers(newChild, runId, slug, workflow, awRoot, cliPath);
          return;
        }
      }
    }

    r.status = code === 0 ? 'completed' : 'failed';
    if (code !== null) r.exitCode = code;
    r.completedAt = new Date().toISOString();
    eventBus.broadcast({
      type: code === 0 ? 'run:completed' : 'run:failed',
      data: { runId, slug, exitCode: code },
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * After an intentional stop, update workflow-state.json on disk so that
 * resume.ts won't revive the workflow on server restart.
 * Uses sync I/O because the exit handler runs in a tight window.
 */
function markWorkflowStopped(slug: string): void {
  try {
    const awRoot = getAwRoot();
    const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);
    const entries = readdirSync(workspaceDir, { encoding: 'utf-8' });
    const waveDirs = entries.filter((e: string) => /^wave-\d+$/.test(e)).sort();
    const lastWave = waveDirs[waveDirs.length - 1];
    if (!lastWave) return;

    const statePath = path.join(workspaceDir, lastWave, 'workflow-state.json');
    const raw = readFileSync(statePath, 'utf-8');
    const ws = JSON.parse(raw) as Record<string, unknown>;

    ws['status'] = 'stopped';
    ws['stopped_reason'] = 'intentional_stop';

    // Mark running steps as interrupted
    const steps = ws['steps'] as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(steps)) {
      for (const step of steps) {
        if (step['status'] === 'running') {
          step['status'] = 'interrupted';
          step['completed_at'] = new Date().toISOString();
        }
      }
    }

    writeFileSync(statePath, JSON.stringify(ws, null, 2));
  } catch {
    // Best-effort — don't crash the exit handler
  }
}

async function writeServerCrashReport(
  slug: string,
  message: string,
  exitCode: number | null,
  signal: NodeJS.Signals | null,
): Promise<void> {
  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);
  const waveDirs = await listWaveDirs(workspaceDir);
  const lastWave = waveDirs[waveDirs.length - 1];
  if (!lastWave) return;

  const waveDir = path.join(workspaceDir, lastWave);
  const crashPath = path.join(waveDir, 'crash-report.log');

  // Don't overwrite a crash report already written by the engine
  try {
    readFileSync(crashPath);
    return;
  } catch { /* does not exist — proceed */ }

  const timestamp = new Date().toISOString();
  const lines = [
    '=== CRASH REPORT ===',
    `timestamp:     ${timestamp}`,
    `handler:       server-detected`,
    `pid:           N/A`,
    `node:          ${process.version}`,
    `platform:      ${process.platform}`,
    `uptime:        N/A`,
    '',
    '--- error ---',
    message,
    `exit_code: ${exitCode}`,
    `signal: ${signal}`,
    '',
  ];

  // Append workflow-state if available
  try {
    const stateRaw = readFileSync(path.join(waveDir, 'workflow-state.json'), 'utf8');
    lines.push('--- workflow-state ---');
    lines.push(stateRaw);
    lines.push('');
  } catch {
    lines.push('--- workflow-state: (unavailable) ---');
    lines.push('');
  }

  writeFileSync(crashPath, lines.join('\n'), 'utf8');
}

const app = new Hono();

export async function startRun(slug: string, workflow: string): Promise<{ runId: string; pid: number }> {
  const awRoot = getAwRoot();
  const cliPath = path.join(awRoot, 'apps', 'engine', 'dist', 'cli.js');
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);

  const runId = randomUUID();
  const startedAt = new Date().toISOString();

  await writeServerRunMeta(workspaceDir, { run_mode: 'spawn', run_id: runId, started_at: startedAt });

  const child = spawnEngineChild(awRoot, cliPath, slug, workflow);

  if (child.pid === undefined) {
    throw new Error('Failed to spawn engine process');
  }

  const pid = child.pid;

  const run: Run = {
    id: runId,
    slug,
    workflow,
    pid,
    status: 'running',
    mode: 'spawn',
    startedAt,
  };
  runsStore.set(runId, run);

  attachEngineHandlers(child, runId, slug, workflow, awRoot, cliPath);

  eventBus.broadcast({
    type: 'run:started',
    data: { runId, slug, workflow, pid },
    timestamp: new Date().toISOString(),
  });

  return { runId, pid };
}

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

  try {
    const { runId, pid } = await startRun(slug, workflow);
    return c.json({ runId, pid }, 201);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 500);
  }
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

  // Write stopped state BEFORE killing — guarantees persistence even if exit handler doesn't fire
  markWorkflowStopped(run.slug);

  try {
    run.intentionalStop = true;
    process.kill(run.pid, 'SIGTERM');
  } catch {
    run.intentionalStop = false;
    return c.json({ error: 'Failed to send SIGTERM' }, 500);
  }

  return c.json({ ok: true });
});

export function isRunActive(runId: string): boolean {
  return runsStore.get(runId)?.status === 'running';
}

export { app as runs };

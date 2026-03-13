import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isPidAlive } from '../lib/pid-check.js';
import {
  listWaveDirs,
  buildStepList,
  deriveWaveStatus,
  findActiveStepJsonl,
  type StepStatus,
} from '../lib/wave-state.js';
import { getAwRoot } from '../lib/paths.js';

const app = new Hono();

// GET /api/v1/pid/:pid/alive
app.get('/:pid/alive', (c) => {
  const pidParam = c.req.param('pid');

  if (!/^\d+$/.test(pidParam)) {
    return c.json({ error: 'PID must be a numeric value' }, 400);
  }

  const pid = parseInt(pidParam, 10);
  const alive = isPidAlive(pid);

  return c.json({ alive });
});


async function getRunSummary(slug: string): Promise<{ wave_status: StepStatus | null; last_output_age_ms: number | null }> {
  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);
  const waveDirNames = await listWaveDirs(workspaceDir);
  const currentWaveDirName = waveDirNames[waveDirNames.length - 1];
  if (!currentWaveDirName) return { wave_status: null, last_output_age_ms: null };

  const wavePath = path.join(workspaceDir, currentWaveDirName);
  const steps = await buildStepList(wavePath);
  const wave_status = deriveWaveStatus(steps);

  const activeJsonlPath = await findActiveStepJsonl(wavePath);
  let last_output_age_ms: number | null = null;
  if (activeJsonlPath) {
    try {
      const stat = await fs.stat(activeJsonlPath);
      last_output_age_ms = Date.now() - stat.mtimeMs;
    } catch { /* ignore */ }
  }

  return { wave_status, last_output_age_ms };
}

// GET /api/v1/runs/active
// Lists all workspaces where the engine is currently alive, derived from disk state.
const active = new Hono();

active.get('/', async (c) => {
  const awRoot = getAwRoot();
  const workspacesDir = path.join(awRoot, 'context', 'workspaces');

  let slugs: string[];
  try {
    slugs = await fs.readdir(workspacesDir);
  } catch {
    return c.json([]);
  }

  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const ws = await fs.readFile(path.join(workspacesDir, slug, 'workspace.json'), 'utf-8');
        const { engine_pid } = JSON.parse(ws) as { engine_pid?: number };
        if (!engine_pid || !isPidAlive(engine_pid)) return null;
        const summary = await getRunSummary(slug).catch(() => ({ wave_status: null as StepStatus | null, last_output_age_ms: null as number | null }));
        return { slug, alive: true, ...summary };
      } catch {
        return null;
      }
    })
  );

  return c.json(results.filter(Boolean));
});

export { app as pid, active as activeRuns };

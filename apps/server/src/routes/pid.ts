import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isPidAlive } from '../lib/pid-check.js';
import {
  listWaveDirs,
  buildStepList,
  deriveWaveStatus,
  findActiveStepJsonl,
  readWorkflowState,
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


interface RunSummary {
  wave_status: StepStatus | null;
  last_output_age_ms: number | null;
  wave_number: number | null;
  steps_completed: number;
  steps_total: number;
}

async function getRunSummary(slug: string): Promise<RunSummary> {
  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);
  const waveDirNames = await listWaveDirs(workspaceDir);
  const currentWaveDirName = waveDirNames[waveDirNames.length - 1];
  if (!currentWaveDirName) return { wave_status: null, last_output_age_ms: null, wave_number: null, steps_completed: 0, steps_total: 0 };

  const waveNumber = parseInt(currentWaveDirName.replace('wave-', ''), 10);
  const wavePath = path.join(workspaceDir, currentWaveDirName);
  const steps = await buildStepList(wavePath);
  const wave_status = deriveWaveStatus(steps);
  const steps_completed = steps.filter((s) => s.status === 'completed').length;
  const steps_total = steps.length;

  const activeJsonlPath = await findActiveStepJsonl(wavePath);
  let last_output_age_ms: number | null = null;
  if (activeJsonlPath) {
    try {
      const stat = await fs.stat(activeJsonlPath);
      last_output_age_ms = Date.now() - stat.mtimeMs;
    } catch { /* ignore */ }
  }

  return { wave_status, last_output_age_ms, wave_number: waveNumber, steps_completed, steps_total };
}

async function getProjectName(slug: string): Promise<string | null> {
  const awRoot = getAwRoot();
  const projectFile = path.join(awRoot, 'context', 'projects', slug, 'project.json');
  try {
    const data = JSON.parse(await fs.readFile(projectFile, 'utf-8')) as { name?: string };
    return data.name ?? null;
  } catch {
    return null;
  }
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

        // engine_pid is never cleared from workspace.json, so a stale-but-recycled PID
        // (or an engine still alive but past this workspace) would otherwise leak
        // completed runs into the active list. Trust workflow-state.json as the
        // authoritative per-workspace run status.
        const workspaceDir = path.join(workspacesDir, slug);
        const waveDirNames = await listWaveDirs(workspaceDir);
        const currentWaveDirName = waveDirNames[waveDirNames.length - 1];
        if (currentWaveDirName) {
          const wfState = await readWorkflowState(path.join(workspaceDir, currentWaveDirName));
          if (wfState?.status && wfState.status !== 'running') return null;
        }

        const summary = await getRunSummary(slug).catch(() => ({ wave_status: null, last_output_age_ms: null, wave_number: null, steps_completed: 0, steps_total: 0 } as RunSummary));
        const name = await getProjectName(slug).catch(() => null);
        return { slug, name, alive: true, ...summary };
      } catch {
        return null;
      }
    })
  );

  return c.json(results.filter(Boolean));
});

export { app as pid, active as activeRuns };

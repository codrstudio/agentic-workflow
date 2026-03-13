import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from './paths.js';
import { isPidAlive } from './pid-check.js';
import { listWaveDirs, readWorkflowState, readJson } from './wave-state.js';
import { readServerRunMeta, startRun } from '../routes/runs.js';

export async function resumeInterruptedWorkflows(): Promise<void> {
  const awRoot = getAwRoot();
  const workspacesDir = path.join(awRoot, 'context', 'workspaces');

  let entries: string[];
  try {
    entries = await fs.readdir(workspacesDir);
  } catch {
    return;
  }

  const slugs = entries.filter((e) => !e.startsWith('.'));

  for (const slug of slugs) {
    try {
      await maybeResumeWorkspace(awRoot, slug);
    } catch (err) {
      console.error(`[resume] Error checking workspace "${slug}":`, err);
    }
  }
}

async function maybeResumeWorkspace(awRoot: string, slug: string): Promise<void> {
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);

  // Default: detached — only resume if explicitly marked as spawn
  const runMeta = await readServerRunMeta(workspaceDir);
  const runMode = runMeta?.run_mode ?? 'detached';
  if (runMode !== 'spawn') return;

  // If engine PID is still alive, it's already running — don't touch it
  let enginePid: number | undefined;
  try {
    const workspaceJson = await readJson(path.join(workspaceDir, 'workspace.json')) as Record<string, unknown>;
    enginePid = workspaceJson['engine_pid'] as number | undefined;
  } catch { /* workspace.json may not exist */ }

  if (enginePid !== undefined && isPidAlive(enginePid)) return;

  // Find the last wave and check for interrupted steps
  const waveDirs = await listWaveDirs(workspaceDir);
  if (waveDirs.length === 0) return;

  const lastWaveDir = waveDirs[waveDirs.length - 1]!;
  const waveState = await readWorkflowState(path.join(workspaceDir, lastWaveDir));
  if (!waveState) return;

  const hasInterruptedStep = waveState.steps.some((s) => s.status === 'running');
  if (!hasInterruptedStep) return;

  const { workflow } = waveState;
  console.log(`[resume] Resuming interrupted workflow for "${slug}" (${workflow})`);

  await startRun(slug, workflow);
}

import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from '../lib/paths.js';
import {
  readJson,
  buildStepList,
  listWaveDirs,
  computeWaveTiming,
  deriveWaveStatus,
  findLatestSprintDir,
  countFeaturesByStatus,
  resolveLatestAttemptDir,
  type LoopJson,
  type StepStatus,
} from '../lib/wave-state.js';

const app = new Hono();

// GET /api/v1/projects/:slug/stats
app.get('/', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) return c.json({ error: 'Project slug required' }, 400);

  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);

  let waveDirs: string[] = [];
  try {
    waveDirs = await listWaveDirs(workspaceDir);
  } catch {
    return c.json({ wave_stats: [], crash_count: 0, feature_totals: null });
  }

  // Build wave stats with timing and feature counters
  const waveStats = await Promise.all(
    waveDirs.map(async (waveDir) => {
      const waveNumber = parseInt(waveDir.replace('wave-', ''), 10);
      const wavePath = path.join(workspaceDir, waveDir);
      const steps = await buildStepList(wavePath);

      const status = deriveWaveStatus(steps);
      const timing = computeWaveTiming(steps);

      // Compute wave duration from step timestamps
      let duration_ms: number | null = null;
      const timestamps = steps
        .filter((s) => s.started_at)
        .map((s) => new Date(s.started_at!).getTime());
      const finishTimestamps = steps
        .filter((s) => s.finished_at)
        .map((s) => new Date(s.finished_at!).getTime());

      if (timestamps.length > 0) {
        const start = Math.min(...timestamps);
        const end = finishTimestamps.length > 0 ? Math.max(...finishTimestamps) : Date.now();
        duration_ms = end - start;
      }

      // Try to get feature counters for this wave
      let features: { passing: number; failing: number; skipped: number; pending: number; in_progress: number; blocked: number } | null = null;
      let featureTotal = 0;

      const sprint = await findLatestSprintDir(wavePath);
      if (sprint) {
        try {
          const featuresData = await readJson(path.join(sprint.sprintDir, 'features.json')) as Array<Record<string, unknown>>;
          if (Array.isArray(featuresData)) {
            features = countFeaturesByStatus(featuresData);
            featureTotal = featuresData.length;
          }
        } catch {
          // no features.json
        }
      }

      // Try to get loop iteration data
      let loopIterations: number | null = null;
      for (const step of steps) {
        if (step.type === 'ralph-wiggum-loop') {
          const stepDirName = `step-${String(step.index).padStart(2, '0')}-ralph-wiggum-loop`;
          const stepPath = path.join(wavePath, stepDirName);
          try {
            const latestAttemptDir = await resolveLatestAttemptDir(stepPath);
            const loop = await readJson(path.join(latestAttemptDir, 'loop.json')) as LoopJson;
            loopIterations = loop.iteration ?? null;
          } catch {
            // loop.json not available
          }
          break;
        }
      }

      return {
        wave_number: waveNumber,
        status,
        steps_total: steps.length,
        steps_completed: steps.filter((s) => s.status === 'completed').length,
        steps_failed: steps.filter((s) => s.status === 'failed').length,
        duration_ms,
        avg_step_ms: timing?.completed_steps_avg_ms ?? null,
        features,
        feature_total: featureTotal,
        loop_iterations: loopIterations,
      };
    })
  );

  // Count crashes
  let crashCount = 0;
  for (const waveDir of waveDirs) {
    const wavePath = path.join(workspaceDir, waveDir);
    try {
      const entries = await fs.readdir(wavePath);
      for (const entry of entries) {
        if (entry === 'crash-report.log' || entry.startsWith('stagnation-report-')) {
          crashCount++;
        }
      }
    } catch {
      // ignore
    }
  }

  // Aggregate feature totals across latest sprint
  let featureTotals: { passing: number; failing: number; skipped: number; pending: number; in_progress: number; blocked: number; total: number } | null = null;
  // Use the last wave that has features
  for (let i = waveStats.length - 1; i >= 0; i--) {
    const ws = waveStats[i];
    if (ws && ws.features) {
      featureTotals = {
        ...ws.features,
        total: ws.feature_total,
      };
      break;
    }
  }

  return c.json({
    wave_stats: waveStats,
    crash_count: crashCount,
    feature_totals: featureTotals,
  });
});

export { app as stats };

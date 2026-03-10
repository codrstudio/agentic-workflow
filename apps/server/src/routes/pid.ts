import { Hono } from 'hono';
import { isPidAlive } from '../lib/pid-check.js';
import { runsStore } from './runs.js';

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

// GET /api/v1/runs/active
// Lists all runs with status "running", enriched with alive field
const active = new Hono();

active.get('/', (c) => {
  const activeRuns = [...runsStore.values()]
    .filter((r) => r.status === 'running')
    .map((r) => ({ ...r, alive: isPidAlive(r.pid) }));

  return c.json(activeRuns);
});

export { app as pid, active as activeRuns };

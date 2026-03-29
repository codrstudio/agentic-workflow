import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { eventBus } from '../lib/event-bus.js';
import { startRun } from './runs.js';

export interface Trigger {
  id: string;
  targetSlug: string;
  targetWorkflow: string;
  sourceSlug: string;
  sourceWorkflow?: string;
  createdAt: string;
}

// sourceSlug → triggers that fire when sourceSlug completes
export const triggerStore = new Map<string, Trigger[]>();

/**
 * Called from the run exit handler when a run completes successfully.
 * Fires all matching triggers for the given source slug/workflow (one-shot: removes after firing).
 */
export function fireTriggers(sourceSlug: string, sourceWorkflow: string): void {
  const triggers = triggerStore.get(sourceSlug);
  if (!triggers || triggers.length === 0) return;

  const toFire: Trigger[] = [];
  const remaining: Trigger[] = [];

  for (const t of triggers) {
    if (!t.sourceWorkflow || t.sourceWorkflow === sourceWorkflow) {
      toFire.push(t);
    } else {
      remaining.push(t);
    }
  }

  if (remaining.length === 0) {
    triggerStore.delete(sourceSlug);
  } else {
    triggerStore.set(sourceSlug, remaining);
  }

  for (const t of toFire) {
    eventBus.broadcast({
      type: 'run:triggered',
      data: {
        triggerId: t.id,
        sourceSlug: t.sourceSlug,
        targetSlug: t.targetSlug,
        targetWorkflow: t.targetWorkflow,
      },
      timestamp: new Date().toISOString(),
    });

    startRun(t.targetSlug, t.targetWorkflow).catch(() => {
      eventBus.broadcast({
        type: 'run:failed',
        data: { runId: t.id, slug: t.targetSlug, exitCode: null },
        timestamp: new Date().toISOString(),
      });
    });
  }
}

const app = new Hono();

// POST /api/v1/triggers
app.post('/', async (c) => {
  const body = await c.req.json<{
    targetSlug: string;
    targetWorkflow: string;
    sourceSlug: string;
    sourceWorkflow?: string;
  }>();

  const { targetSlug, targetWorkflow, sourceSlug, sourceWorkflow } = body;

  if (!targetSlug || !targetWorkflow || !sourceSlug) {
    return c.json({ error: 'targetSlug, targetWorkflow, and sourceSlug are required' }, 400);
  }

  const trigger: Trigger = {
    id: randomUUID(),
    targetSlug,
    targetWorkflow,
    sourceSlug,
    sourceWorkflow: sourceWorkflow || undefined,
    createdAt: new Date().toISOString(),
  };

  const list = triggerStore.get(sourceSlug) ?? [];
  list.push(trigger);
  triggerStore.set(sourceSlug, list);

  eventBus.broadcast({
    type: 'run:trigger:created',
    data: { id: trigger.id, targetSlug, targetWorkflow, sourceSlug, sourceWorkflow },
    timestamp: new Date().toISOString(),
  });

  return c.json(trigger, 201);
});

// GET /api/v1/triggers?target=slug
app.get('/', (c) => {
  const targetFilter = c.req.query('target');
  const all: Trigger[] = [];

  for (const triggers of triggerStore.values()) {
    for (const t of triggers) {
      if (!targetFilter || t.targetSlug === targetFilter) {
        all.push(t);
      }
    }
  }

  return c.json(all);
});

// DELETE /api/v1/triggers/:id
app.delete('/:id', (c) => {
  const id = c.req.param('id')!;

  for (const [sourceSlug, triggers] of triggerStore.entries()) {
    const idx = triggers.findIndex((t) => t.id === id);
    if (idx !== -1) {
      const removed = triggers[idx]!;
      triggers.splice(idx, 1);
      if (triggers.length === 0) triggerStore.delete(sourceSlug);

      eventBus.broadcast({
        type: 'run:trigger:removed',
        data: { id: removed.id, targetSlug: removed.targetSlug, sourceSlug: removed.sourceSlug },
        timestamp: new Date().toISOString(),
      });

      return c.json({ ok: true });
    }
  }

  return c.json({ error: 'Trigger not found' }, 404);
});

export { app as triggers };

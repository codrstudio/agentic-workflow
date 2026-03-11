import { Hono } from 'hono';
import { eventBus } from '../lib/event-bus.js';

const app = new Hono();

// POST /api/v1/hub/engine-events
// Receives an EngineEvent from the CLI and broadcasts it to SSE clients.
app.post('/', async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid json' }, 400);
  }

  if (typeof body !== 'object' || body === null) {
    return c.json({ error: 'invalid' }, 400);
  }

  const event = body as Record<string, unknown>;
  if (typeof event['type'] !== 'string' || typeof event['timestamp'] !== 'string') {
    return c.json({ error: 'invalid' }, 400);
  }

  eventBus.broadcast({
    type: event['type'],
    data: event,
    timestamp: event['timestamp'],
  });

  return c.json({ ok: true }, 202);
});

export { app as engineEvents };

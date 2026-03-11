import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { eventBus } from '../lib/event-bus.js';
import { getAwRoot } from '../lib/paths.js';

const app = new Hono();

// POST /api/v1/projects/:slug/messages
app.post('/', async (c) => {
  const slug = c.req.param('slug');
  if (!slug) {
    return c.json({ error: 'Project slug is required' }, 400);
  }

  let body: { content?: string; source?: string };
  try {
    body = await c.req.json<{ content?: string; source?: string }>();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { content, source } = body;
  if (!content || typeof content !== 'string' || !content.trim()) {
    return c.json({ error: 'content is required' }, 400);
  }

  const id = randomUUID();
  const timestamp = new Date().toISOString();

  // Build OperatorMessage compatible with engine's OperatorQueue.enqueue()
  const operatorMessage = {
    id,
    timestamp,
    message: content,
    source: source ?? 'hub',
  };

  // Append to operator-queue.jsonl in workspace directory
  const awRoot = getAwRoot();
  const queuePath = path.join(awRoot, 'context', 'workspaces', slug, 'operator-queue.jsonl');
  try {
    await fs.mkdir(path.dirname(queuePath), { recursive: true });
    await fs.appendFile(queuePath, JSON.stringify(operatorMessage) + '\n', 'utf-8');
  } catch {
    return c.json({ error: 'Failed to write to operator queue' }, 500);
  }

  // Emit SSE event
  eventBus.broadcast({
    type: 'operator:message:queued',
    data: { slug, message: { ...operatorMessage, status: 'queued' } },
    timestamp,
  });

  return c.json({ ...operatorMessage, status: 'queued' }, 201);
});

export { app as messages };

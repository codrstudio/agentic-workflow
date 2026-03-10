import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { eventBus, type HubEvent } from '../lib/event-bus.js';
import { getAwRoot } from '../lib/paths.js';

type MessageStatus = 'queued' | 'processing' | 'done';

interface HubMessage {
  id: string;
  timestamp: string;
  message: string;
  source?: string;
  status: MessageStatus;
}

// In-memory store: slug → messages
const messageStore = new Map<string, HubMessage[]>();

function getMessages(slug: string): HubMessage[] {
  if (!messageStore.has(slug)) {
    messageStore.set(slug, []);
  }
  return messageStore.get(slug)!;
}

// Listen to engine events to update message status
eventBus.on('event', (event: HubEvent) => {
  if (event.type !== 'engine:event') return;
  const payload = event.data as { slug?: string; payload?: { type?: string } };
  const slug = payload.slug;
  if (!slug) return;

  const engineType = payload.payload?.type;
  if (engineType === 'queue:processing') {
    const msgs = getMessages(slug);
    for (const m of msgs) {
      if (m.status === 'queued') m.status = 'processing';
    }
  } else if (engineType === 'queue:done') {
    const msgs = getMessages(slug);
    for (const m of msgs) {
      if (m.status === 'processing') m.status = 'done';
    }
  }
});

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

  // Store in memory with status queued
  const hubMessage: HubMessage = { ...operatorMessage, status: 'queued' };
  getMessages(slug).push(hubMessage);

  // Emit SSE event
  eventBus.broadcast({
    type: 'operator:message:queued',
    data: { slug, message: hubMessage },
    timestamp,
  });

  return c.json(hubMessage, 201);
});

// GET /api/v1/projects/:slug/messages
app.get('/', (c) => {
  const slug = c.req.param('slug');
  if (!slug) {
    return c.json({ error: 'Project slug is required' }, 400);
  }

  return c.json(getMessages(slug));
});

export { app as messages };

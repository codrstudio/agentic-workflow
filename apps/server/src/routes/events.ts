import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { eventBus, type HubEvent } from '../lib/event-bus.js';

const app = new Hono();

// GET /api/v1/events
app.get('/', (c) => {
  return streamSSE(c, async (stream) => {
    const handler = async (event: HubEvent) => {
      try {
        await stream.writeSSE({
          event: event.type,
          data: JSON.stringify(event.data),
        });
      } catch {
        // client disconnected — onAbort will clean up
      }
    };

    // Flush an initial event so the browser receives the first byte
    // and transitions EventSource from CONNECTING to OPEN immediately
    await stream.writeSSE({ event: 'keepalive', data: '' });

    eventBus.on('event', handler);

    // Keepalive every 30s to prevent proxy/browser timeouts
    const keepaliveId = setInterval(() => {
      stream.writeSSE({ event: 'keepalive', data: '' }).catch(() => {
        clearInterval(keepaliveId);
      });
    }, 30_000);

    stream.onAbort(() => {
      clearInterval(keepaliveId);
      eventBus.off('event', handler);
    });

    // Hold the stream open until the client disconnects
    await new Promise<void>((resolve) => {
      stream.onAbort(resolve);
    });
  });
});

export { app as events };

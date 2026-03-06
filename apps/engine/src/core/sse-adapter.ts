import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Notifier } from './notifier.js';
import type { EngineEvent } from '../schemas/event.js';

export class SSEAdapter {
  private connections = new Set<ServerResponse>();

  constructor(private readonly notifier: Notifier) {
    this.notifier.on('engine:event', (event: EngineEvent) => {
      this.broadcast(event);
    });
  }

  /**
   * HTTP handler for SSE endpoint.
   * Attach to a route: server.get('/events', adapter.handler.bind(adapter))
   */
  handler(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial keepalive
    res.write(':ok\n\n');

    this.connections.add(res);

    res.on('close', () => {
      this.connections.delete(res);
    });
  }

  /**
   * Broadcast an event to all connected SSE clients.
   */
  private broadcast(event: EngineEvent): void {
    const payload = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
    for (const res of this.connections) {
      res.write(payload);
    }
  }

  /**
   * Close all connections gracefully.
   */
  close(): void {
    for (const res of this.connections) {
      res.end();
    }
    this.connections.clear();
  }

  get connectionCount(): number {
    return this.connections.size;
  }
}

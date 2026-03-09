import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { eventBus } from "./index.js";
import type {
  SystemHeartbeatEvent,
  WorkflowStartedEvent,
  WorkflowCompletedEvent,
  StepExecutedEvent,
  FeatureStatusChangedEvent,
} from "./index.js";

// --- Types ---

interface SSEClient {
  id: string;
  channelId: string;
  write: (eventName: string, data: string) => Promise<void>;
}

// --- SSE Hub ---

class SSEHub {
  private channels = new Map<string, Set<SSEClient>>();
  private lastChannelEvents = new Map<string, { event: string; data: string }>();

  constructor() {
    this.wireEventBus();
  }

  subscribe(channelId: string, write: SSEClient["write"]): SSEClient {
    const client: SSEClient = {
      id: crypto.randomUUID(),
      channelId,
      write,
    };
    if (!this.channels.has(channelId)) {
      this.channels.set(channelId, new Set());
    }
    this.channels.get(channelId)!.add(client);
    return client;
  }

  unsubscribe(client: SSEClient): void {
    const set = this.channels.get(client.channelId);
    if (set) {
      set.delete(client);
      if (set.size === 0) this.channels.delete(client.channelId);
    }
  }

  hasListeners(channelId: string): boolean {
    const set = this.channels.get(channelId);
    return !!set && set.size > 0;
  }

  getClientCount(channelId: string): number {
    return this.channels.get(channelId)?.size ?? 0;
  }

  broadcast(channelId: string, eventName: string, payload: unknown): void {
    const data = JSON.stringify(payload);
    this.lastChannelEvents.set(channelId, { event: eventName, data });

    const clients = this.channels.get(channelId);
    if (!clients) return;

    for (const client of clients) {
      client.write(eventName, data).catch(() => {
        this.unsubscribe(client);
      });
    }
  }

  getLastEvent(channelId: string): { event: string; data: string } | undefined {
    return this.lastChannelEvents.get(channelId);
  }

  private wireEventBus(): void {
    eventBus.on("system:heartbeat", (evt: SystemHeartbeatEvent) => {
      this.broadcast("system", "system:heartbeat", evt);
    });

    eventBus.on("workflow:started", (evt: WorkflowStartedEvent) => {
      this.broadcast("system", "workflow:started", evt);
    });

    eventBus.on("workflow:completed", (evt: WorkflowCompletedEvent) => {
      this.broadcast("system", "workflow:completed", evt);
    });

    eventBus.on("step:executed", (evt: StepExecutedEvent) => {
      this.broadcast("system", "step:executed", evt);
    });

    eventBus.on("feature:status-changed", (evt: FeatureStatusChangedEvent) => {
      this.broadcast("system", "feature:status-changed", evt);
    });
  }
}

export const sseHub = new SSEHub();

// --- Hono SSE Handler ---

export function createSSEHandler(channelId: string) {
  return (c: Context) => {
    return streamSSE(c, async (stream) => {
      // Initial event para reverse-proxies (Vite, nginx) forward headers
      await stream.writeSSE({
        event: "connected",
        data: JSON.stringify({ channelId }),
      });

      const client = sseHub.subscribe(channelId, async (event, data) => {
        await stream.writeSSE({ event, data });
      });

      // Catch-up event se disponível
      const last = sseHub.getLastEvent(channelId);
      if (last) {
        await stream.writeSSE({ event: last.event, data: last.data });
      }

      stream.onAbort(() => {
        sseHub.unsubscribe(client);
      });

      // Keep-alive ping loop
      while (true) {
        await stream.sleep(30_000);
        await stream.writeSSE({ event: "ping", data: "" });
      }
    });
  };
}

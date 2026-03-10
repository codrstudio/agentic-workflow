import { EventEmitter } from 'node:events';

export interface HubEvent {
  type: string;
  data: unknown;
  timestamp: string;
}

class EventBus extends EventEmitter {
  broadcast(event: HubEvent): void {
    this.emit('event', event);
  }
}

export const eventBus = new EventBus();
// Allow many simultaneous SSE clients without triggering MaxListeners warning
eventBus.setMaxListeners(0);

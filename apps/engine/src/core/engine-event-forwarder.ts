import type { EngineEvent } from '../schemas/event.js';

/**
 * Forwards EngineEvents to the hub server via fire-and-forget POST.
 * Failures are silent — never blocks or throws.
 */
export class EngineEventForwarder {
  constructor(private readonly baseUrl: string) {}

  forward(event: EngineEvent): void {
    fetch(`${this.baseUrl}/api/v1/hub/engine-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3_000),
    }).catch(() => {});
  }
}

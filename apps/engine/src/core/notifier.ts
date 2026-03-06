import { EventEmitter } from 'node:events';
import type { EngineEvent } from '../schemas/event.js';

export interface NotificationEvent {
  event: string;
  timestamp: string;
  project: {
    slug?: string;
    name?: string;
  };
  data: Record<string, unknown>;
}

export interface WebhookConfig {
  url: string;
  events?: string[];
  secret?: string;
}

export class Notifier extends EventEmitter {
  private webhooks: WebhookConfig[] = [];

  /**
   * Emit a typed EngineEvent.
   * Publishes on both the event type channel and a generic 'engine:event' channel.
   */
  emitEngineEvent(event: EngineEvent): void {
    this.emit(event.type, event);
    this.emit('engine:event', event);
  }

  /**
   * Configure webhooks from session config.
   */
  setWebhooks(webhooks: WebhookConfig[]): void {
    this.webhooks = webhooks;
  }

  /**
   * Emit a notification event locally and to all matching webhooks.
   */
  async notify(event: NotificationEvent): Promise<void> {
    // Local EventEmitter
    this.emit(event.event, event);
    this.emit('*', event);

    // Send to webhooks
    const promises = this.webhooks
      .filter((wh) => {
        if (!wh.events || wh.events.length === 0) return true;
        return wh.events.includes(event.event);
      })
      .map((wh) => this.sendWebhook(wh, event));

    await Promise.allSettled(promises);
  }

  private async sendWebhook(
    webhook: WebhookConfig,
    event: NotificationEvent,
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (webhook.secret) {
        headers['X-Webhook-Secret'] = webhook.secret;
      }

      await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(event),
        signal: controller.signal,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[notifier] Webhook failed (${webhook.url}): ${msg}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

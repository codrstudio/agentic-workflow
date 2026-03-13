import { eventBus, type HubEvent } from './event-bus.js';
import { buildMonitorSnapshot } from '../routes/monitor.js';

const TRIGGER_TYPES = new Set([
  'workflow:start', 'workflow:step:start', 'workflow:step:end', 'workflow:end',
  'loop:start', 'loop:iteration', 'loop:end',
  'feature:start', 'feature:pass', 'feature:fail', 'feature:skip',
  'agent:spawn', 'agent:output', 'agent:exit',
  'gutter:retry', 'gutter:rollback', 'gutter:skip',
  'workflow:chain', 'workflow:spawn', 'workflow:resume',
  'queue:received', 'queue:processing', 'queue:done',
  'run:started', 'run:completed', 'run:failed',
]);

class MonitorService {
  private activeProjects = new Set<string>();
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lastSnapshots = new Map<string, string>();
  private pidTimer: ReturnType<typeof setInterval> | null = null;
  private boundHandler: ((e: HubEvent) => void) | null = null;

  start(): void {
    this.boundHandler = (e) => this.handleEvent(e);
    eventBus.on('event', this.boundHandler);
    this.pidTimer = setInterval(() => {
      for (const slug of this.activeProjects) this.scheduleRecompute(slug, 0);
    }, 5_000);
  }

  stop(): void {
    if (this.boundHandler) { eventBus.off('event', this.boundHandler); this.boundHandler = null; }
    if (this.pidTimer) { clearInterval(this.pidTimer); this.pidTimer = null; }
    for (const t of this.debounceTimers.values()) clearTimeout(t);
    this.debounceTimers.clear();
  }

  private extractSlug(event: HubEvent): string | null {
    const d = event.data as Record<string, unknown>;
    if (typeof d['project_slug'] === 'string') return d['project_slug'];
    if (typeof d['slug'] === 'string') return d['slug'];
    return null;
  }

  private handleEvent(event: HubEvent): void {
    if (!TRIGGER_TYPES.has(event.type)) return;
    const slug = this.extractSlug(event);
    if (!slug) return;
    this.activeProjects.add(slug);
    this.scheduleRecompute(slug, 200);
  }

  private scheduleRecompute(slug: string, debounceMs: number): void {
    const existing = this.debounceTimers.get(slug);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      this.debounceTimers.delete(slug);
      this.recompute(slug).catch((err) =>
        console.error(`[monitor-service] recompute error for "${slug}":`, err)
      );
    }, debounceMs);
    this.debounceTimers.set(slug, timer);
  }

  private async recompute(slug: string): Promise<void> {
    const snapshot = await buildMonitorSnapshot(slug);
    if (!snapshot) return;

    const serialized = JSON.stringify(snapshot);
    if (serialized === this.lastSnapshots.get(slug)) return;
    this.lastSnapshots.set(slug, serialized);

    if (!snapshot.activity.engine_alive && !snapshot.activity.run_active) this.activeProjects.delete(slug);

    eventBus.broadcast({
      type: 'monitor:snapshot',
      data: { project_slug: slug, data: snapshot },
      timestamp: new Date().toISOString(),
    });
  }
}

export const monitorService = new MonitorService();

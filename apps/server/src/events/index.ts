import { EventEmitter } from "node:events";

// --- Event Map (tipos de eventos do sistema) ---

export interface SystemHeartbeatEvent {
  ts: number;
  type: "heartbeat";
  message: string;
}

export interface WorkflowStartedEvent {
  ts: number;
  workflowId: string;
  projectSlug: string;
  message: string;
}

export interface WorkflowCompletedEvent {
  ts: number;
  workflowId: string;
  projectSlug: string;
  status: "success" | "error";
  message: string;
}

export interface StepExecutedEvent {
  ts: number;
  workflowId: string;
  stepNumber: number;
  stepName: string;
  status: "success" | "error" | "skipped";
  message: string;
}

export interface FeatureStatusChangedEvent {
  ts: number;
  workflowId: string;
  featureId: string;
  status: "pending" | "in_progress" | "passing" | "failing" | "skipped" | "blocked";
  message: string;
}

export interface SystemEventMap {
  "system:heartbeat": SystemHeartbeatEvent;
  "workflow:started": WorkflowStartedEvent;
  "workflow:completed": WorkflowCompletedEvent;
  "step:executed": StepExecutedEvent;
  "feature:status-changed": FeatureStatusChangedEvent;
}

// --- Typed Event Bus ---

export class SystemEventBus {
  private emitter = new EventEmitter();
  private lastEvents = new Map<string, unknown>();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit<K extends keyof SystemEventMap>(
    event: K,
    payload: SystemEventMap[K]
  ): void {
    this.lastEvents.set(event, payload);
    this.emitter.emit(event, payload);
  }

  on<K extends keyof SystemEventMap>(
    event: K,
    listener: (payload: SystemEventMap[K]) => void
  ): void {
    this.emitter.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof SystemEventMap>(
    event: K,
    listener: (payload: SystemEventMap[K]) => void
  ): void {
    this.emitter.off(event, listener as (...args: unknown[]) => void);
  }

  getLastEvent<K extends keyof SystemEventMap>(
    event: K
  ): SystemEventMap[K] | undefined {
    return this.lastEvents.get(event) as SystemEventMap[K] | undefined;
  }
}

export const eventBus = new SystemEventBus();

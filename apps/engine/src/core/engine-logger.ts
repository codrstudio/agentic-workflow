import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { EngineEvent } from '../schemas/event.js';

let logPath: string | null = null;

export function setLogPath(path: string): void {
  logPath = path;
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch {
    // best effort
  }
}

export function getLogPath(): string | null {
  return logPath;
}

function writeEntry(entry: Record<string, unknown>): void {
  if (!logPath) return;
  try {
    appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch {
    // never crash the engine over a log write failure
  }
}

export function logEvent(event: EngineEvent): void {
  writeEntry(event);
}

export function logInfo(message: string, data?: Record<string, unknown>): void {
  writeEntry({
    type: 'engine:info',
    timestamp: new Date().toISOString(),
    data: { message, ...data },
  });
}

export function logError(message: string, error?: unknown): void {
  writeEntry({
    type: 'engine:error',
    timestamp: new Date().toISOString(),
    data: {
      message,
      error: error instanceof Error ? error.stack ?? error.message : String(error ?? ''),
    },
  });
}

function writeCrash(type: string, error: unknown): void {
  const entry = {
    type: 'engine:crash',
    timestamp: new Date().toISOString(),
    data: {
      handler: type,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
      pid: process.pid,
    },
  };
  if (logPath) {
    try {
      appendFileSync(logPath, JSON.stringify(entry) + '\n');
    } catch {
      process.stderr.write(JSON.stringify(entry) + '\n');
    }
  } else {
    process.stderr.write(JSON.stringify(entry) + '\n');
  }
}

export function installCrashHandlers(): void {
  process.on('uncaughtException', (err) => {
    writeCrash('uncaughtException', err);
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    writeCrash('unhandledRejection', reason);
    process.exit(1);
  });
}

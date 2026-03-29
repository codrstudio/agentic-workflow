import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { EngineEvent } from '../schemas/event.js';

let logPath: string | null = null;
let runCtx: { projectSlug?: string; waveNumber?: number } = {};

export function setRunContext(ctx: { projectSlug?: string; waveNumber?: number }): void {
  runCtx = ctx;
}

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
  const timestamp = new Date().toISOString();
  const entry = {
    type: 'engine:crash',
    timestamp,
    data: {
      handler: type,
      error: error instanceof Error ? error.stack ?? error.message : String(error),
      pid: process.pid,
    },
  };

  // Write to engine.jsonl
  if (logPath) {
    try {
      appendFileSync(logPath, JSON.stringify(entry) + '\n');
    } catch {
      process.stderr.write(JSON.stringify(entry) + '\n');
    }
  } else {
    process.stderr.write(JSON.stringify(entry) + '\n');
  }

  // Write crash-report.log alongside engine.jsonl
  if (logPath) {
    try {
      const waveDir = dirname(logPath);
      const lines: string[] = [];

      lines.push('=== CRASH REPORT ===');
      lines.push(`timestamp:     ${timestamp}`);
      lines.push(`handler:       ${type}`);
      lines.push(`pid:           ${process.pid}`);
      lines.push(`node:          ${process.version}`);
      lines.push(`platform:      ${process.platform}`);
      lines.push(`uptime:        ${process.uptime().toFixed(1)}s`);
      if (runCtx.projectSlug) lines.push(`project:       ${runCtx.projectSlug}`);
      if (runCtx.waveNumber !== undefined) lines.push(`wave:          ${runCtx.waveNumber}`);
      lines.push(`argv:          ${process.argv.join(' ')}`);
      lines.push('');

      const mem = process.memoryUsage();
      lines.push('--- memory ---');
      lines.push(`rss:           ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
      lines.push(`heapUsed:      ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
      lines.push(`heapTotal:     ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`);
      lines.push('');

      lines.push('--- error ---');
      lines.push(error instanceof Error ? (error.stack ?? error.message) : String(error));
      lines.push('');

      try {
        const stateRaw = readFileSync(join(waveDir, 'workflow-state.json'), 'utf8');
        lines.push('--- workflow-state ---');
        lines.push(stateRaw);
        lines.push('');
      } catch {
        lines.push('--- workflow-state: (unavailable) ---');
        lines.push('');
      }

      try {
        const logRaw = readFileSync(logPath, 'utf8');
        const logLines = logRaw.split('\n').filter(Boolean);
        const tail = logLines.slice(-50);
        lines.push(`--- engine.jsonl (last ${tail.length} lines) ---`);
        lines.push(tail.join('\n'));
        lines.push('');
      } catch {
        lines.push('--- engine.jsonl: (unavailable) ---');
        lines.push('');
      }

      writeFileSync(join(waveDir, 'crash-report.log'), lines.join('\n'), 'utf8');
    } catch {
      // never crash the crash handler
    }
  }
}

export interface StagnationReportParams {
  waveDir: string;
  task: string;
  agent: string;
  step: number;
  pid: number;
  inactivityMs: number;
  feature?: string;
  attempt?: number;
  outputDir: string;
}

export function writeStagnationReport(params: StagnationReportParams): void {
  const timestamp = new Date().toISOString();

  // Write to engine.jsonl
  const entry = {
    type: 'engine:stagnation',
    timestamp,
    data: {
      handler: 'agent-stagnation',
      task: params.task,
      agent: params.agent,
      step: params.step,
      pid: params.pid,
      inactivity_ms: params.inactivityMs,
      feature: params.feature,
      attempt: params.attempt,
    },
  };
  writeEntry(entry);

  try {
    const lines: string[] = [];

    lines.push('=== CRASH REPORT ===');
    lines.push(`timestamp:     ${timestamp}`);
    lines.push(`handler:       agent-stagnation`);
    lines.push(`pid:           ${params.pid}`);
    lines.push(`node:          ${process.version}`);
    lines.push(`platform:      ${process.platform}`);
    lines.push(`uptime:        ${process.uptime().toFixed(1)}s`);
    if (runCtx.projectSlug) lines.push(`project:       ${runCtx.projectSlug}`);
    if (runCtx.waveNumber !== undefined) lines.push(`wave:          ${runCtx.waveNumber}`);
    lines.push(`task:          ${params.task}`);
    lines.push(`agent:         ${params.agent}`);
    lines.push(`step:          ${params.step}`);
    if (params.feature) lines.push(`feature:       ${params.feature}`);
    if (params.attempt !== undefined) lines.push(`attempt:       ${params.attempt}`);
    lines.push(`inactivity:    ${(params.inactivityMs / 60_000).toFixed(1)} min`);
    lines.push(`argv:          ${process.argv.join(' ')}`);
    lines.push('');

    const mem = process.memoryUsage();
    lines.push('--- memory ---');
    lines.push(`rss:           ${(mem.rss / 1024 / 1024).toFixed(1)} MB`);
    lines.push(`heapUsed:      ${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
    lines.push(`heapTotal:     ${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`);
    lines.push('');

    lines.push('--- error ---');
    lines.push(`Agent stagnation detected: no output for ${(params.inactivityMs / 60_000).toFixed(1)} minutes`);
    lines.push(`Task: ${params.task} | Agent: ${params.agent} | PID: ${params.pid}`);
    lines.push(`Output directory: ${params.outputDir}`);
    lines.push('');

    try {
      const stateRaw = readFileSync(join(params.waveDir, 'workflow-state.json'), 'utf8');
      lines.push('--- workflow-state ---');
      lines.push(stateRaw);
      lines.push('');
    } catch {
      lines.push('--- workflow-state: (unavailable) ---');
      lines.push('');
    }

    if (logPath) {
      try {
        const logRaw = readFileSync(logPath, 'utf8');
        const logLines = logRaw.split('\n').filter(Boolean);
        const tail = logLines.slice(-50);
        lines.push(`--- engine.jsonl (last ${tail.length} lines) ---`);
        lines.push(tail.join('\n'));
        lines.push('');
      } catch {
        lines.push('--- engine.jsonl: (unavailable) ---');
        lines.push('');
      }
    }

    const filename = `stagnation-report-${params.task}-${params.pid}.log`;
    writeFileSync(join(params.waveDir, filename), lines.join('\n'), 'utf8');
  } catch {
    // never crash the engine over a stagnation report write failure
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

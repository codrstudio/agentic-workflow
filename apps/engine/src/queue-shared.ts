import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { StateManager } from './core/state-manager.js';

export const state = new StateManager();

// ── Types ──

export interface QueueMessage {
  id: string;
  timestamp: string;
  message: string;
  source?: string;
}

export interface AgentText {
  text: string;
}

export interface DrainState {
  dir: string;
  jsonlPath: string;
  spawnJsonPath: string;
  lastSize: number;
  printedCount: number;
  finished: boolean;
}

// ── Helpers ──

export function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export async function getFileSize(path: string): Promise<number> {
  try {
    const s = await stat(path);
    return s.size;
  } catch {
    return 0;
  }
}

// ── Pending queue ──

export async function showPendingMessages(queuePath: string, log: (msg: string) => void): Promise<void> {
  const text = await state.readText(queuePath);
  if (!text.trim()) return;

  const messages: QueueMessage[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed));
    } catch {
      // skip
    }
  }

  if (messages.length === 0) return;

  log(chalk.yellow(`\n  ${messages.length} pending message(s) in queue:\n`));
  for (const m of messages) {
    const ts = m.timestamp?.replace('T', ' ').replace('Z', '') ?? '?';
    log(`  ${chalk.gray(ts)} [${chalk.cyan(m.source ?? '?')}] ${m.message}`);
  }
  log('');
}

// ── Agent response parsing ──

export function parseAgentMessages(raw: string): AgentText[] {
  const messages: AgentText[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.type !== 'assistant') continue;
      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
          messages.push({ text: block.text.trim() });
        }
      }
    } catch {
      // skip
    }
  }
  return messages;
}

// ── Drain dirs ──

export async function listDrainDirs(queueDir: string): Promise<string[]> {
  try {
    const entries = await readdir(queueDir);
    return entries
      .filter(e => e.match(/^drain-\d+$/))
      .sort((a, b) => {
        const numA = parseInt(a.replace('drain-', ''), 10);
        const numB = parseInt(b.replace('drain-', ''), 10);
        return numA - numB;
      });
  } catch {
    return [];
  }
}

function truncateLine(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}

export function printMessageBlock(msg: AgentText, isCurrent: boolean, log: (msg: string) => void): void {
  const indicator = isCurrent ? chalk.green('▶') : chalk.gray('│');
  const colorFn = isCurrent ? chalk.white : chalk.gray;
  const lines = msg.text.split('\n');
  const displayLines = lines.slice(0, 3);
  for (const line of displayLines) {
    log(`  ${indicator} ${colorFn(truncateLine(line, 100))}`);
  }
  if (lines.length > 3) {
    log(`  ${indicator} ${chalk.gray(`  ... (+${lines.length - 3} lines)`)}`);
  }
}

export async function printNewContent(drain: DrainState, log: (msg: string) => void): Promise<void> {
  const currentSize = await getFileSize(drain.jsonlPath);
  if (currentSize <= drain.lastSize) return;

  let raw: string;
  try {
    raw = await readFile(drain.jsonlPath, 'utf-8');
  } catch {
    return;
  }

  const allMessages = parseAgentMessages(raw);

  if (drain.printedCount === 0 && allMessages.length > 0) {
    const HISTORY_SIZE = 10;
    const startIdx = Math.max(0, allMessages.length - HISTORY_SIZE);
    const slice = allMessages.slice(startIdx);

    if (startIdx > 0) {
      log(`  ${chalk.gray(`  ... ${startIdx} earlier message(s) omitted`)}`);
    }

    for (let i = 0; i < slice.length; i++) {
      const isCurrent = i === slice.length - 1;
      printMessageBlock(slice[i]!, isCurrent, log);
    }

    drain.printedCount = allMessages.length;
  } else {
    const newMessages = allMessages.slice(drain.printedCount);
    for (let i = 0; i < newMessages.length; i++) {
      const isCurrent = i === newMessages.length - 1;
      printMessageBlock(newMessages[i]!, isCurrent, log);
    }
    drain.printedCount = allMessages.length;
  }

  drain.lastSize = currentSize;
}

export async function checkDrainFinished(drain: DrainState, log: (msg: string) => void): Promise<boolean> {
  if (drain.finished) return true;
  try {
    const raw = await readFile(drain.spawnJsonPath, 'utf-8');
    const meta = JSON.parse(raw);
    if (meta.finished_at) {
      drain.finished = true;
      const exitCode = meta.exit_code ?? '?';
      const color = exitCode === 0 ? chalk.green : chalk.red;
      log(`  ${chalk.gray('└')} agent exit=${color(String(exitCode))}${meta.timed_out ? chalk.red(' TIMEOUT') : ''}`);
      return true;
    }
  } catch {
    // spawn.json not ready yet
  }
  return false;
}

export async function findCurrentWaveDir(workspaceDir: string): Promise<{ waveDir: string; waveNumber: number } | null> {
  try {
    const entries = await readdir(workspaceDir);
    const waves = entries
      .map(e => e.match(/^wave-(\d+)$/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map(m => parseInt(m[1]!, 10))
      .sort((a, b) => a - b);

    if (waves.length === 0) return null;
    const waveNumber = waves[waves.length - 1]!;
    return { waveDir: join(workspaceDir, `wave-${waveNumber}`), waveNumber };
  } catch {
    return null;
  }
}

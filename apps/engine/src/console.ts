import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';
import { randomUUID } from 'node:crypto';
import chalk from 'chalk';
import { now } from './core/state-manager.js';
import {
  state, timestamp, getFileSize,
  showPendingMessages, printNewContent, checkDrainFinished,
  listDrainDirs, findCurrentWaveDir,
  type QueueMessage, type DrainState,
} from './queue-shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function usage(): void {
  console.error('Usage: aw:console <project-slug>');
  console.error('');
  console.error('Interactive operator console: send messages and see responses.');
  console.error('');
  console.error('Example:');
  console.error('  npm run aw:console -- arc');
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    usage();
  }

  const projectSlug = args[0]!;
  const contextDir = resolve(__dirname, '..', '..', '..', 'context');
  const workspaceDir = join(contextDir, 'workspaces', projectSlug);
  const queuePath = join(workspaceDir, 'operator-queue.jsonl');

  if (!(await state.fileExists(join(workspaceDir, 'workspace.json')))) {
    console.error(chalk.red(`\n  Workspace for "${projectSlug}" not found.\n`));
    process.exit(1);
  }

  // ── readline setup ──

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan('  > '),
    terminal: true,
  });

  // Write output above the prompt line, then re-display prompt
  const log = (msg: string) => {
    // Move to column 0, clear line, print, then re-show prompt
    process.stdout.write('\r\x1b[K');
    console.log(msg);
    rl.prompt(true);
  };

  // ── Header ──

  console.log(chalk.cyan(`\n  aw:console — ${projectSlug}`));
  console.log(chalk.gray('  Type a message and press Enter to send. Ctrl+C to quit.\n'));

  // Show pending messages
  await showPendingMessages(queuePath, log);

  // ── Drain polling (same as watch) ──

  const knownDrains = new Map<string, DrainState>();
  let lastQueueSize = await getFileSize(queuePath);
  // Track messages we sent so we don't echo them back from pollQueue
  const sentIds = new Set<string>();

  const pollQueue = async () => {
    const currentSize = await getFileSize(queuePath);
    if (currentSize > lastQueueSize && currentSize > 0) {
      const text = await state.readText(queuePath);
      const lines = text.trim().split('\n').filter(l => l.trim());
      // Check for new messages not sent by us
      for (const line of lines) {
        try {
          const msg = JSON.parse(line) as QueueMessage;
          if (!sentIds.has(msg.id)) {
            const ts = chalk.gray(`[${timestamp()}]`);
            log(`${ts} ${chalk.green('queued')} [${chalk.cyan(msg.source ?? '?')}] ${msg.message}`);
            sentIds.add(msg.id);
          }
        } catch {
          // skip
        }
      }
    }
    lastQueueSize = currentSize;
  };

  const pollDrains = async () => {
    const wave = await findCurrentWaveDir(workspaceDir);
    if (!wave) return;

    const queueDir = join(wave.waveDir, 'operator-queue');
    const drainDirs = await listDrainDirs(queueDir);

    for (const dir of drainDirs) {
      const key = join(queueDir, dir);
      if (!knownDrains.has(key)) {
        const ts = chalk.gray(`[${timestamp()}]`);
        log(`\n${ts} ${chalk.cyan('drain')} ${dir} (wave-${wave.waveNumber})\n`);

        knownDrains.set(key, {
          dir,
          jsonlPath: join(key, 'spawn.jsonl'),
          spawnJsonPath: join(key, 'spawn.json'),
          lastSize: 0,
          printedCount: 0,
          finished: false,
        });
      }

      const drain = knownDrains.get(key)!;
      if (!drain.finished) {
        await printNewContent(drain, log);
        await checkDrainFinished(drain, log);
      }
    }
  };

  // ── Input handling ──

  rl.on('line', async (input: string) => {
    const message = input.trim();
    if (!message) {
      rl.prompt();
      return;
    }

    const id = randomUUID();
    sentIds.add(id);

    const msg = {
      id,
      timestamp: now(),
      message,
      source: 'console',
    };

    await state.appendLine(queuePath, JSON.stringify(msg));

    const ts = chalk.gray(`[${timestamp()}]`);
    log(`${ts} ${chalk.green('sent')} ${message}`);

    // Update size so pollQueue doesn't re-announce
    lastQueueSize = await getFileSize(queuePath);
  });

  rl.on('close', () => {
    clearInterval(interval);
    console.log(chalk.gray('\n  Closed.\n'));
    process.exit(0);
  });

  // ── Poll loop ──

  const POLL_MS = 1000;
  const poll = async () => {
    try {
      await pollQueue();
      await pollDrains();
    } catch {
      // transient
    }
  };

  await poll();
  const interval = setInterval(poll, POLL_MS);

  // Show prompt
  rl.prompt();
}

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal: ${err instanceof Error ? err.message : String(err)}\n`));
  process.exit(1);
});

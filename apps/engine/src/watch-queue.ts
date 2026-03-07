import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'node:fs';
import chalk from 'chalk';
import {
  state, timestamp, getFileSize,
  showPendingMessages, printNewContent, checkDrainFinished,
  listDrainDirs, findCurrentWaveDir,
  type QueueMessage, type DrainState,
} from './queue-shared.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function usage(): void {
  console.error('Usage: aw:watch <project-slug>');
  console.error('');
  console.error('Monitors the operator queue response channel in real-time.');
  console.error('Shows pending messages and agent responses as they arrive.');
  console.error('');
  console.error('Example:');
  console.error('  npm run aw:watch -- arc');
  process.exit(1);
}

const log = (msg: string) => console.log(msg);

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

  console.log(chalk.cyan(`\n  aw:watch — ${projectSlug}\n`));
  console.log(chalk.gray('  Monitoring operator queue. Press Ctrl+C to stop.\n'));

  await showPendingMessages(queuePath, log);

  const knownDrains = new Map<string, DrainState>();
  let lastQueueSize = await getFileSize(queuePath);

  const pollQueue = async () => {
    const currentSize = await getFileSize(queuePath);
    if (currentSize > lastQueueSize && currentSize > 0) {
      const text = await state.readText(queuePath);
      const lines = text.trim().split('\n').filter(l => l.trim());
      const lastLine = lines[lines.length - 1];
      if (lastLine) {
        try {
          const msg = JSON.parse(lastLine) as QueueMessage;
          const ts = chalk.gray(`[${timestamp()}]`);
          console.log(`${ts} ${chalk.green('queued')} [${chalk.cyan(msg.source ?? '?')}] ${msg.message}`);
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
        console.log(`\n${ts} ${chalk.cyan('drain')} ${dir} (wave-${wave.waveNumber})`);
        console.log('');

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

  try {
    watch(workspaceDir, { recursive: false }, () => {});
  } catch {
    // polling fallback
  }

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

  const shutdown = () => {
    clearInterval(interval);
    console.log(chalk.gray('\n  Stopped.\n'));
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal: ${err instanceof Error ? err.message : String(err)}\n`));
  process.exit(1);
});

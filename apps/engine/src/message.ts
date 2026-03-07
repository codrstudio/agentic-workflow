import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import chalk from 'chalk';
import { StateManager, now } from './core/state-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const state = new StateManager();

function usage(): void {
  console.error('Usage: aw:message <project-slug> <message>');
  console.error('');
  console.error('Options:');
  console.error('  --source <name>   Source tag (default: "cli")');
  console.error('');
  console.error('Examples:');
  console.error('  npm run aw:message -- arc "usa wrapper ao inves de SDK"');
  console.error('  npm run aw:message -- arc "qual o status da feature F-003?" --source operator');
  process.exit(1);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    usage();
  }

  const projectSlug = args[0]!;

  // Parse --source flag
  let source = 'cli';
  const messageParts: string[] = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--source' && i + 1 < args.length) {
      source = args[i + 1]!;
      i++; // skip next
    } else {
      messageParts.push(args[i]!);
    }
  }

  const message = messageParts.join(' ');
  if (!message) {
    console.error(chalk.red('\n  Message cannot be empty.\n'));
    process.exit(1);
  }

  const contextDir = resolve(__dirname, '..', '..', '..', 'context');
  const workspaceDir = join(contextDir, 'workspaces', projectSlug);
  const queuePath = join(workspaceDir, 'operator-queue.jsonl');

  // Check workspace exists
  if (!(await state.fileExists(join(workspaceDir, 'workspace.json')))) {
    console.error(chalk.red(`\n  Workspace for "${projectSlug}" not found.\n`));
    process.exit(1);
  }

  const msg = {
    id: randomUUID(),
    timestamp: now(),
    message,
    source,
  };

  await state.appendLine(queuePath, JSON.stringify(msg));

  console.log(`${chalk.green('queued')} ${chalk.gray(msg.id.slice(0, 8))} [${chalk.cyan(source)}] ${message}`);
}

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal: ${err instanceof Error ? err.message : String(err)}\n`));
  process.exit(1);
});

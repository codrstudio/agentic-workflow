import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import chalk from 'chalk';
import { bootstrap } from './core/bootstrap.js';
import { WorkflowRunner, type WorkflowRunnerContext } from './core/workflow-engine.js';
import { installCrashHandlers, setLogPath, logEvent as writeLogEvent, logInfo, logError } from './core/engine-logger.js';
import type { EngineEvent } from './schemas/event.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Install crash handlers as early as possible — before any async work.
// Captures uncaughtException + unhandledRejection with sync file write.
installCrashHandlers();

function usage(): void {
  console.error('Usage: aw:run <project-slug> <workflow-slug>');
  console.error('');
  console.error('Example:');
  console.error('  npm run aw:run -- arc vibe-app');
  process.exit(1);
}

function timestamp(): string {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

function logEvent(event: EngineEvent): void {
  const ts = chalk.gray(`[${timestamp()}]`);
  const d = event.data;

  switch (event.type) {
    case 'workflow:start':
      console.log(`${ts} ${chalk.cyan('workflow:start')}       ${d.workflow} (wave ${d.wave}, ${d.steps} steps)`);
      break;
    case 'workflow:step:start':
      console.log(`${ts} ${chalk.blue('step:start')}           [${d.index}/${d.total ?? '?'}] ${d.step} (${d.type})`);
      break;
    case 'workflow:step:end':
      console.log(`${ts} ${chalk.blue('step:end')}             ${d.step} ${d.result}`);
      break;
    case 'workflow:end':
      console.log(`${ts} ${chalk.cyan('workflow:end')}         ${d.reason}`);
      break;
    case 'agent:spawn':
      console.log(`${ts} ${chalk.yellow('agent:spawn')}          ${d.task} (${d.agent}${d.mode ? `, ${d.mode}` : ''})`);
      break;
    case 'agent:exit': {
      const color = d.exit_code === 0 ? chalk.green : chalk.red;
      console.log(`${ts} ${chalk.yellow('agent:exit')}           ${d.task} exit=${color(String(d.exit_code))}${d.timed_out ? chalk.red(' TIMEOUT') : ''}`);
      break;
    }
    case 'loop:start':
      console.log(`${ts} ${chalk.magenta('loop:start')}           ${d.total ?? '?'} features`);
      break;
    case 'loop:iteration':
      console.log(`${ts} ${chalk.magenta('loop:iteration')}       round ${d.iteration}`);
      break;
    case 'loop:end':
      console.log(`${ts} ${chalk.magenta('loop:end')}             ${d.reason}`);
      break;
    case 'feature:start':
      console.log(`${ts} ${chalk.blue('feature:start')}        ${d.feature_id} ${d.feature_name}`);
      break;
    case 'feature:pass':
      console.log(`${ts} ${chalk.green('feature:pass')}         ${d.feature_id} ${d.feature_name}`);
      break;
    case 'feature:fail':
      console.log(`${ts} ${chalk.red('feature:fail')}         ${d.feature_id} ${d.feature_name} (retry ${d.retries})`);
      break;
    case 'feature:skip':
      console.log(`${ts} ${chalk.yellow('feature:skip')}         ${d.feature_id} ${d.feature_name}`);
      break;
    case 'gutter:retry':
      console.log(`${ts} ${chalk.yellow('gutter:retry')}         ${d.feature_id} retry ${d.retries}`);
      break;
    case 'gutter:rollback':
      console.log(`${ts} ${chalk.red('gutter:rollback')}      ${d.feature_id}`);
      break;
    case 'gutter:skip':
      console.log(`${ts} ${chalk.red('gutter:skip')}          ${d.feature_id}`);
      break;
    case 'workflow:chain':
      console.log(`${ts} ${chalk.cyan('workflow:chain')}       ${d.from} -> ${d.to}`);
      break;
    case 'workflow:spawn':
      console.log(`${ts} ${chalk.cyan('workflow:spawn')}       ${d.from} -> ${d.to} (new wave)`);
      break;
    case 'workflow:resume':
      console.log(`${ts} ${chalk.green('workflow:resume')}     step ${d.index} (${d.step}) skipped (already completed)`);
      break;
    case 'queue:received':
      console.log(`${ts} ${chalk.cyan('queue:received')}      "${String(d.message).slice(0, 80)}${String(d.message).length > 80 ? '...' : ''}"`);
      break;
    case 'queue:processing':
      console.log(`${ts} ${chalk.cyan('queue:processing')}    draining ${d.count} message(s)`);
      break;
    case 'queue:done':
      console.log(`${ts} ${chalk.cyan('queue:done')}          agent exit=${d.exit_code}${d.timed_out ? chalk.red(' TIMEOUT') : ''}`);
      break;
    default:
      console.log(`${ts} ${chalk.gray(event.type)}  ${JSON.stringify(d)}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    usage();
  }

  // Parse --plan flag
  let planSlug: string | undefined;
  const positionalArgs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--plan' && i + 1 < args.length) {
      planSlug = args[++i];
    } else {
      positionalArgs.push(args[i]!);
    }
  }

  const [projectSlug, workflowSlug] = positionalArgs as [string, string];
  const contextDir = resolve(__dirname, '..', '..', '..', 'context');

  console.log(chalk.cyan(`\n  agentic-workflow\n`));
  console.log(`  project:  ${chalk.bold(projectSlug)}`);
  console.log(`  workflow: ${chalk.bold(workflowSlug)}`);
  console.log(`  context:  ${contextDir}\n`);

  // Bootstrap
  const result = await bootstrap(contextDir, projectSlug, workflowSlug, planSlug);

  // Activate engine log file now that we know the wave dir
  const engineLogPath = join(result.waveDir, 'engine.log');
  setLogPath(engineLogPath);
  logInfo('engine started', {
    project: projectSlug,
    workflow: workflowSlug,
    wave: result.waveNumber,
    sprint: result.sprintNumber,
    plan: result.plan.slug,
    pid: process.pid,
    resumed: result.resumed,
  });

  console.log(`  workspace: ${result.workspaceDir}`);
  console.log(`  repo:      ${result.repoDir}`);
  console.log(`  worktree:  ${result.worktreeInfo.path}`);
  console.log(`  wave:      ${result.waveNumber}${result.resumed ? chalk.yellow(' (resuming)') : ''}`);
  console.log(`  sprint:    ${result.sprintNumber}`);
  console.log(`  plan:      ${result.plan.slug} (${result.plan.name})\n`);

  // Build context
  const ctx: WorkflowRunnerContext = {
    workflow: result.workflow,
    plan: result.plan,
    projectName: result.projectConfig.name,
    projectSlug: result.projectConfig.slug,
    workflowSlug,
    workspaceDir: result.workspaceDir,
    projectDir: result.projectDir,
    repoDir: result.repoDir,
    waveDir: result.waveDir,
    worktreeDir: result.worktreeInfo.path,
    sprintDir: result.sprintDir,
    waveNumber: result.waveNumber,
    sprintNumber: result.sprintNumber,
    agentsDir: join(contextDir, 'agents'),
    tasksDir: join(contextDir, 'tasks'),
    workflowsDir: join(contextDir, 'workflows'),
    params: result.projectConfig.params as Record<string, unknown> | undefined,
    sourceBranch: result.resolvedRepoConfig?.source_branch,
    targetBranch: result.resolvedRepoConfig?.target_branch,
    autoMerge: result.resolvedRepoConfig?.auto_merge,
    waveLimit: result.projectConfig.wave_limit,
  };

  // Create runner
  const runner = new WorkflowRunner();

  // Attach event logger (console + file)
  runner.notifier.on('engine:event', (event: EngineEvent) => {
    logEvent(event);
    writeLogEvent(event);
  });

  // Signal handling
  const onSignal = () => {
    console.log(chalk.yellow('\n  Received signal, stopping...\n'));
    runner.stop();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  // Execute workflow
  const execResult = await runner.execute(ctx);

  // Merge worktree into target branch (skip if stopped by signal)
  if (execResult.exitCode === 0 && execResult.reason !== 'stopped') {
    const mergeResult = await runner.spawnMerge(ctx);

    if (mergeResult.exitCode === 0 && result.resolvedRepoConfig) {
      const { source_branch, target_branch, auto_merge } = result.resolvedRepoConfig;
      if (auto_merge) {
        try {
          execSync(`git checkout "${source_branch}"`, { cwd: result.repoDir, stdio: 'pipe' });
          execSync(`git merge "${target_branch}" --no-edit`, { cwd: result.repoDir, stdio: 'pipe' });
          console.log(chalk.green(`\n  Auto-merged ${target_branch} -> ${source_branch}\n`));
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(chalk.red(`\n  Auto-merge failed: ${msg}\n`));
        }
      } else {
        console.log(chalk.yellow(`\n  auto_merge=false. Create MR: ${target_branch} -> ${source_branch}\n`));
      }
    }
  }

  // Cleanup resources before exit
  runner.cleanup();
  process.exit(execResult.exitCode);
}

main().catch((err) => {
  logError('main() fatal', err);
  console.error(chalk.red(`\n  Fatal: ${err instanceof Error ? err.message : String(err)}\n`));
  process.exit(1);
});

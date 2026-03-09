import { resolve, dirname, join } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { loadProjectConfig } from './core/bootstrap.js';
import { StateManager } from './core/state-manager.js';
import type { Feature } from './schemas/feature.js';
import type { WorkflowState, WorkflowStepState } from './schemas/workflow-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const state = new StateManager();

// ── Types ──

interface LoopState {
  status: string;
  pid?: number;
  iteration: number;
  total: number;
  done: number;
  remaining: number;
  features_done: number;
  feature_id?: string;
  current_feature?: string;
  updated_at?: string;
}

interface StepInfo {
  index: number;
  task: string;
  type: string;
  status: string;        // from workflow-state
  started_at: string | null;
  completed_at: string | null;
  exit_code: number | null;
  // derived
  dirName: string;       // "step-01-pain-gain-analysis"
  loop: LoopState | null;
}

interface AgentMessage {
  text: string;
}

interface SpawnInfo {
  pid: number;
  parent_pid: number;
  started_at: string;
  finished_at?: string;
  exit_code?: number;
  feature?: string;
}

interface ActivityInfo {
  lastJsonlMtime: Date | null;   // file mtime of the active spawn.jsonl
  loopUpdatedAt: string | null;  // loop.json updated_at
  stepStartedAt: string | null;  // started_at for the active step
  spawn: SpawnInfo | null;       // active spawn metadata
}

// ── Usage ──

function usage(): void {
  console.error('Usage: aw:status <project-slug>');
  console.error('');
  console.error('Example:');
  console.error('  npm run aw:status -- arc');
  process.exit(1);
}

// ── Helpers ──

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const secs = Math.round(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h${remMins}m ago` : `${hours}h ago`;
}

function formatDuration(startedAt: string, finishedAt?: string): string {
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const secs = Math.round((end - new Date(startedAt).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return remSecs > 0 ? `${mins}m${String(remSecs).padStart(2, '0')}s` : `${mins}m`;
}

function stepDirSlug(type: string, task: string): string {
  if (type === 'ralph-wiggum-loop') return 'ralph-wiggum-loop';
  return task;
}

function deriveStepDirName(index: number, type: string, task: string): string {
  const nn = String(index).padStart(2, '0');
  return `step-${nn}-${stepDirSlug(type, task)}`;
}

function stepLabel(type: string, task: string): string {
  return stepDirSlug(type, task);
}

async function listWaves(workspaceDir: string): Promise<number[]> {
  const waves: number[] = [];
  try {
    const entries = await readdir(workspaceDir);
    for (const entry of entries) {
      const match = entry.match(/^wave-(\d+)$/);
      if (match) waves.push(parseInt(match[1]!, 10));
    }
  } catch {
    return [];
  }
  return waves.sort((a, b) => a - b);
}

async function loadSteps(waveDir: string): Promise<StepInfo[]> {
  const wfState = await state.readJson<WorkflowState>(join(waveDir, 'workflow-state.json'));
  if (!wfState || !Array.isArray(wfState.steps)) return [];

  const steps: StepInfo[] = [];
  for (const s of wfState.steps) {
    const dirName = deriveStepDirName(s.index, s.type, s.task);
    const loop = s.type === 'ralph-wiggum-loop'
      ? await state.readJson<LoopState>(join(waveDir, dirName, 'loop.json'))
      : null;
    steps.push({
      index: s.index,
      task: s.task,
      type: s.type,
      status: s.status,
      started_at: s.started_at,
      completed_at: s.completed_at,
      exit_code: s.exit_code,
      dirName,
      loop,
    });
  }
  return steps;
}

function findActiveStep(steps: StepInfo[]): StepInfo | null {
  // First: step with running status
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.status === 'running') return s;
    if (s.loop && s.loop.status === 'running') return s;
  }
  // Fallback: last step that has started
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]!.started_at) return steps[i]!;
  }
  return null;
}

async function readLastMessages(jsonlPath: string, n: number): Promise<AgentMessage[]> {
  let raw: string;
  try {
    raw = await readFile(jsonlPath, 'utf-8');
  } catch {
    return [];
  }

  const messages: AgentMessage[] = [];
  const lines = raw.split('\n').filter(l => l.trim());

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.type !== 'assistant') continue;
      const content = obj.message?.content;
      if (!Array.isArray(content)) continue;
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
          messages.push({ text: block.text.trim() });
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages.slice(-n);
}

interface EngineLogEntry {
  type: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

async function readLastEngineMessages(logPath: string, n: number): Promise<AgentMessage[]> {
  let raw: string;
  try {
    raw = await readFile(logPath, 'utf-8');
  } catch {
    return [];
  }

  const messages: AgentMessage[] = [];
  const lines = raw.split('\n').filter(l => l.trim());

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as EngineLogEntry;
      const type = entry.type;
      const data = entry.data || {};

      let message = '';

      if (type === 'workflow:start') {
        message = `workflow start: ${data.workflow}`;
      } else if (type === 'workflow:step:start') {
        const stepType = data.type as string;
        const stepName = data.step as string;
        message = `step: ${stepName} (${stepType})`;
      } else if (type === 'workflow:step:end') {
        const stepName = data.step as string;
        const result = data.result as string;
        if (result?.includes('error') || result?.includes('EPERM')) {
          message = `step failed: ${stepName}`;
        } else {
          message = `step end: ${stepName}`;
        }
      } else if (type === 'workflow:step:complete') {
        const exitCode = data.exit_code as number;
        const stepName = data.step as string;
        const status = exitCode === 0 ? 'OK' : `FAIL(${exitCode})`;
        message = `step complete: ${stepName} → ${status}`;
      } else if (type === 'workflow:end') {
        const reason = data.reason as string;
        message = `workflow end: ${reason}`;
      } else if (type === 'agent:spawn') {
        const task = data.task as string;
        const agent = data.agent as string;
        message = `agent spawn: ${task} (${agent})`;
      } else if (type === 'agent:exit') {
        const exitCode = data.exit_code as number;
        const status = exitCode === 0 ? 'success' : `fail(${exitCode})`;
        message = `agent exit: ${status}`;
      } else if (type === 'loop:start') {
        message = `loop: starting iteration ${data.iteration}`;
      } else if (type === 'loop:end') {
        const reason = data.reason as string;
        if (reason === 'success') {
          message = `loop: complete`;
        } else if (reason === 'error') {
          const errorMsg = (data.error as string)?.split('\n')[0]?.slice(0, 40) || 'unknown error';
          message = `loop error: ${errorMsg}`;
        } else {
          message = `loop: ${reason}`;
        }
      } else if (type === 'feature:attempt:start') {
        const featureId = data.feature_id as string;
        message = `feature attempt: ${featureId}`;
      } else if (type === 'feature:attempt:complete') {
        const featureId = data.feature_id as string;
        const status = data.status as string;
        message = `feature result: ${featureId} → ${status}`;
      } else if (type === 'merge:start') {
        message = 'merge: starting';
      } else if (type === 'merge:complete') {
        const status = data.success ? 'success' : 'failed';
        message = `merge: ${status}`;
      } else if (type === 'worktree:create') {
        message = 'worktree: created';
      } else if (type === 'worktree:cleanup') {
        message = 'worktree: cleaned up';
      } else {
        // Generic: show type and any key fields
        const fields = Object.entries(data)
          .filter(([k]) => !k.startsWith('_'))
          .slice(0, 2)
          .map(([, v]) => String(v).slice(0, 20))
          .join(' / ');
        message = `${type}${fields ? ': ' + fields : ''}`;
      }

      if (message) {
        messages.push({ text: message });
      }
    } catch {
      // skip malformed lines
    }
  }

  return messages.slice(-n);
}

function truncate(text: string, max: number): string {
  // Take first line only, truncate if needed
  const firstLine = text.split('\n')[0] ?? text;
  if (firstLine.length <= max) return firstLine;
  return firstLine.slice(0, max - 1) + '…';
}

async function getFileMtime(path: string): Promise<Date | null> {
  try {
    const s = await stat(path);
    return s.mtime;
  } catch {
    return null;
  }
}

// ── Find the active spawn.jsonl (may be in a feature attempt dir) ──

async function findActiveSpawn(step: StepInfo, waveDir: string): Promise<{ jsonlPath: string; spawnJsonPath: string; label: string } | null> {
  const stepDir = join(waveDir, step.dirName);

  // For loop steps, find the latest attempt dir by spawn.jsonl mtime
  if (step.loop) {
    try {
      const entries = await readdir(stepDir);
      const attemptDirs = entries.filter(e => e.match(/^F-\d{3}-attempt-\d+$/));
      const withMtime: { dir: string; path: string; mtime: Date }[] = [];
      for (const attemptDir of attemptDirs) {
        const jsonlPath = join(stepDir, attemptDir, 'spawn.jsonl');
        const mtime = await getFileMtime(jsonlPath);
        if (mtime) withMtime.push({ dir: attemptDir, path: jsonlPath, mtime });
      }
      withMtime.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      if (withMtime.length > 0) {
        const bestDir = withMtime[0]!.dir;
        return {
          jsonlPath: withMtime[0]!.path,
          spawnJsonPath: join(stepDir, bestDir, 'spawn.json'),
          label: `${step.dirName}, ${bestDir}`,
        };
      }
    } catch {
      // ignore
    }
  }

  // Direct spawn.jsonl
  const directPath = join(stepDir, 'spawn.jsonl');
  if (await state.fileExists(directPath)) {
    return { jsonlPath: directPath, spawnJsonPath: join(stepDir, 'spawn.json'), label: step.dirName };
  }

  return null;
}

async function loadSpawnInfo(spawnJsonPath: string): Promise<SpawnInfo | null> {
  try {
    const raw = await readFile(spawnJsonPath, 'utf-8');
    const obj = JSON.parse(raw);
    if (obj && typeof obj.pid === 'number') return obj as SpawnInfo;
  } catch {
    // ignore
  }
  return null;
}

async function getActivityInfo(step: StepInfo, jsonlPath: string | null, spawnJsonPath: string | null): Promise<ActivityInfo> {
  const lastJsonlMtime = jsonlPath ? await getFileMtime(jsonlPath) : null;
  const loopUpdatedAt = step.loop?.updated_at ?? null;
  const stepStartedAt = step.started_at;
  const spawn = spawnJsonPath ? await loadSpawnInfo(spawnJsonPath) : null;
  return { lastJsonlMtime, loopUpdatedAt, stepStartedAt, spawn };
}

function formatRelativeMs(ms: number): string {
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h${remMins}m ago` : `${hours}h ago`;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function printActivitySummary(activity: ActivityInfo, loop?: LoopState | null): void {
  const lines: string[] = [];
  const now = Date.now();

  // Engine PID
  if (activity.spawn && activity.spawn.parent_pid > 0) {
    const epid = activity.spawn.parent_pid;
    if (isProcessAlive(epid)) {
      lines.push(`    engine pid:   ${chalk.cyan(String(epid))} ${chalk.green('alive')}`);
    } else {
      lines.push(`    engine pid:   ${chalk.gray(String(epid))} ${chalk.red('dead')}`);
    }
  } else if (loop?.pid && loop.pid > 0) {
    const epid = loop.pid;
    if (isProcessAlive(epid)) {
      lines.push(`    engine pid:   ${chalk.cyan(String(epid))} ${chalk.green('alive')}`);
    } else {
      lines.push(`    engine pid:   ${chalk.gray(String(epid))} ${chalk.red('dead')}`);
    }
  }

  // Agent PID
  if (activity.spawn) {
    const pid = activity.spawn.pid;
    if (pid === 0) {
      lines.push(`    agent pid:    ${chalk.yellow('awaiting spawn')}`);
    } else if (activity.spawn.finished_at) {
      lines.push(`    agent pid:    ${chalk.gray(String(pid))} ${chalk.gray('(exited)')}`);
    } else if (isProcessAlive(pid)) {
      lines.push(`    agent pid:    ${chalk.cyan(String(pid))} ${chalk.green('alive')}`);
    } else {
      lines.push(`    agent pid:    ${chalk.gray(String(pid))} ${chalk.red('dead')}`);
    }
  }

  // Last output activity (jsonl mtime)
  if (activity.lastJsonlMtime) {
    const silenceMs = now - activity.lastJsonlMtime.getTime();
    const silenceLabel = formatRelativeMs(silenceMs);
    const STUCK_THRESHOLD = 5 * 60 * 1000; // 5 minutes
    if (silenceMs >= STUCK_THRESHOLD) {
      lines.push(`    last output:  ${chalk.red(silenceLabel)}  ${chalk.red.bold('◉ possibly stuck')}`);
    } else {
      lines.push(`    last output:  ${chalk.white(silenceLabel)}`);
    }
  }

  // Loop last state change
  if (activity.loopUpdatedAt) {
    const loopMs = now - new Date(activity.loopUpdatedAt).getTime();
    lines.push(`    loop update:  ${formatRelativeMs(loopMs)}`);
  }

  // Step elapsed
  if (activity.stepStartedAt) {
    const elapsed = formatDuration(activity.stepStartedAt);
    lines.push(`    step elapsed: ${elapsed}`);
  }

  // Engine liveness check
  if (loop?.pid && (loop.status === 'running' || loop.status === 'starting')) {
    if (!isProcessAlive(loop.pid)) {
      lines.push(`    engine:       ${chalk.red.bold('◉ engine dead (stale state)')}`);
    }
  }

  if (lines.length > 0) {
    console.log('');
    console.log(`  ${chalk.gray('timing')}`);
    for (const line of lines) {
      console.log(line);
    }
  }
}

// ── Print functions ──

function printHeader(projectName: string, projectSlug: string, workflowSlug: string, sprintNumber: number, waveCount: number): void {
  console.log('');
  console.log(`  ${chalk.bold(projectSlug)} — ${projectName}`);
  console.log(`  workflow: ${workflowSlug} | sprint: ${sprintNumber} | waves: ${waveCount}`);
}

function stepBadge(step: StepInfo): string {
  switch (step.status) {
    case 'completed':
      return step.exit_code === 0 ? chalk.green('OK') : chalk.red(`FAIL(${step.exit_code})`);
    case 'running':
      return chalk.yellow('RUN');
    case 'failed':
      return chalk.red('FAIL');
    case 'interrupted':
      return chalk.red('INT');
    case 'pending':
    default:
      return chalk.gray('--');
  }
}

async function printWaveDetail(waveNum: number, steps: StepInfo[], features?: Feature[] | null): Promise<void> {
  const anyRunning = steps.some(s => s.status === 'running');
  const allCompleted = steps.length > 0 && steps.every(s => s.status === 'completed');
  const anyFailed = steps.some(s => s.status === 'failed' || s.status === 'interrupted');
  const firstStarted = steps.find(s => s.started_at);

  let waveStatus: string;
  let timeInfo: string;
  if (anyRunning && firstStarted) {
    waveStatus = chalk.yellow('running');
    timeInfo = chalk.gray(`(started ${formatRelativeTime(firstStarted.started_at!)})`);
  } else if (allCompleted) {
    waveStatus = chalk.green('completed');
    const lastCompleted = [...steps].reverse().find(s => s.completed_at);
    timeInfo = firstStarted?.started_at && lastCompleted?.completed_at
      ? chalk.gray(formatDuration(firstStarted.started_at, lastCompleted.completed_at))
      : '';
  } else if (anyFailed && !anyRunning) {
    waveStatus = chalk.red('stopped');
    timeInfo = '';
  } else if (steps.length === 0) {
    waveStatus = chalk.gray('empty');
    timeInfo = '';
  } else {
    // Some pending, none running — either not started or paused
    const anyStarted = steps.some(s => s.started_at);
    waveStatus = anyStarted ? chalk.gray('stopped') : chalk.gray('pending');
    timeInfo = '';
  }

  console.log('');
  console.log(`  ${chalk.cyan(`wave-${waveNum}`)}  ${waveStatus}  ${timeInfo}`);
  console.log('');
  console.log(`  ${chalk.gray('steps')}`);

  for (const step of steps) {
    const num = String(step.index).padStart(2, '0');
    const label = stepLabel(step.type, step.task).padEnd(26);
    const badge = stepBadge(step);

    let duration = '';
    if (step.started_at) {
      // When running, ignore stale completed_at from a previous execution
      const endTs = step.status === 'running' ? undefined : (step.completed_at ?? undefined);
      duration = chalk.gray(formatDuration(step.started_at, endTs));
    }

    let extra = '';

    // Loop-specific info
    if (step.loop) {
      const l = step.loop;
      // Compute metrics from features.json (source of truth) when available
      const done = features ? features.filter(f => f.status === 'passing').length : l.done;
      const total = features ? features.length : l.total;
      const skipped = features ? features.filter(f => f.status === 'skipped').length : (l.total - l.remaining - l.done);
      const remaining = total - done - skipped;
      let loopExtra = `(iter ${l.iteration}, ${done}/${total} done`;
      if (skipped > 0) loopExtra += `, ${skipped} skip`;
      if (remaining > 0) loopExtra += `, ${remaining} left`;
      loopExtra += ')';
      extra += '  ' + chalk.gray(loopExtra);
    }

    console.log(`    ${num} ${label} ${badge.padEnd(12)} ${duration}${extra}`);
  }
}

function printFeatures(features: Feature[], sprintNumber: number): void {
  console.log('');
  console.log(`  ${chalk.gray(`features (sprint-${sprintNumber})`)}`);

  for (const f of features) {
    const id = f.id;
    const name = (f.name ?? '').padEnd(32);
    const status = f.status;
    let colorFn: typeof chalk.green;
    switch (status) {
      case 'passing': colorFn = chalk.green; break;
      case 'failing': colorFn = chalk.red; break;
      case 'skipped': colorFn = chalk.yellow; break;
      case 'in_progress': colorFn = chalk.blue; break;
      case 'blocked': colorFn = chalk.gray; break;
      case 'pending': colorFn = chalk.gray; break;
      default: colorFn = chalk.white;
    }

    let extra = '';
    if (f.retries && f.retries > 0) extra += `  (${f.retries} retries)`;
    if (status === 'blocked' && f.dependencies.length > 0) {
      extra += `  ${chalk.gray('→')} deps: ${f.dependencies.join(', ')}`;
    }
    if (status === 'skipped' && f.skip_reason) {
      extra += `  (${f.skip_reason})`;
    }

    console.log(`    ${chalk.bold(id)} ${name} ${colorFn(status)}${extra}`);
  }
}

function printLastMessages(messages: AgentMessage[], sourceLabel: string): void {
  if (messages.length === 0) return;

  const label = sourceLabel === 'engine' ? 'last engine output' : `last agent output (${sourceLabel})`;
  console.log('');
  console.log(`  ${chalk.gray(label)}`);

  for (let i = 0; i < messages.length; i++) {
    const text = truncate(messages[i]!.text, 80);
    const isLast = i === messages.length - 1;
    if (isLast) {
      console.log(`    ${chalk.gray('│')} ${chalk.white.bold(text)}`);
    } else {
      console.log(`    ${chalk.gray('│')} ${chalk.gray(text)}`);
    }
  }
}

function printWaveHistory(waves: number[], currentWave: number, waveData: Map<number, { steps: StepInfo[]; features?: Feature[] }>): void {
  const historyWaves = waves.filter(w => w !== currentWave);
  if (historyWaves.length === 0) return;

  console.log('');
  console.log(`  ${chalk.gray('history')}`);

  for (const waveNum of historyWaves) {
    const data = waveData.get(waveNum);
    if (!data) continue;

    const { steps } = data;
    const allCompleted = steps.length > 0 && steps.every(s => s.status === 'completed');
    const firstStarted = steps.find(s => s.started_at);
    const lastCompleted = [...steps].reverse().find(s => s.completed_at);

    let status: string;
    let duration: string;
    if (allCompleted && firstStarted?.started_at && lastCompleted?.completed_at) {
      status = chalk.green('completed');
      duration = chalk.gray(formatDuration(firstStarted.started_at, lastCompleted.completed_at));
    } else {
      status = chalk.yellow('incomplete');
      duration = '';
    }

    // Count features done from the features.json at that point (we can't easily know per-wave)
    let featureInfo = '';
    if (data.features) {
      const passing = data.features.filter(f => f.status === 'passing').length;
      featureInfo = chalk.gray(`(${passing}/${data.features.length} features)`);
    }

    console.log(`    wave-${waveNum}  ${status}  ${duration}  ${featureInfo}`);
  }
}

// ── Main ──

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    usage();
  }

  const projectSlug = args[0]!;
  const contextDir = resolve(__dirname, '..', '..', '..', 'context');

  // Load project
  let projectConfig;
  try {
    projectConfig = await loadProjectConfig(contextDir, projectSlug);
  } catch {
    console.error(chalk.red(`\n  Project "${projectSlug}" not found in context/projects/\n`));
    process.exit(1);
  }

  const workspaceDir = join(contextDir, 'workspaces', projectSlug);
  const repoDir = join(workspaceDir, 'repo');

  // Load workspace.json
  const workspaceJson = await state.readJson<{ project: string; workflow: string; created_at: string }>(
    join(workspaceDir, 'workspace.json'),
  );
  if (!workspaceJson) {
    console.log(`\n  ${chalk.yellow('No workspace found.')} Run ${chalk.bold(`npm run aw:run -- ${projectSlug} <workflow>`)} to create one.\n`);
    process.exit(0);
  }

  const workflowSlug = workspaceJson.workflow ?? 'unknown';

  const waves = await listWaves(workspaceDir);

  // Read sprint from current wave's workflow-state.json
  let sprintNumber = 1;
  if (waves.length > 0) {
    const currentWaveNum = waves[waves.length - 1]!;
    const waveStatePath = join(workspaceDir, `wave-${currentWaveNum}`, 'workflow-state.json');
    const ws = await state.readJson<WorkflowState>(waveStatePath);
    if (ws && typeof ws.sprint === 'number') {
      sprintNumber = ws.sprint;
    }
  }

  // ── Section 1: Header ──
  printHeader(projectConfig.name, projectSlug, workflowSlug, sprintNumber, waves.length);

  if (waves.length === 0) {
    console.log(`\n  ${chalk.gray('No waves yet.')}\n`);
    process.exit(0);
  }

  // Load all wave data
  const waveData = new Map<number, { steps: StepInfo[] }>();
  for (const waveNum of waves) {
    const waveDir = join(workspaceDir, `wave-${waveNum}`);
    const steps = await loadSteps(waveDir);
    waveData.set(waveNum, { steps });
  }

  const currentWave = waves[waves.length - 1]!;
  const currentData = waveData.get(currentWave)!;
  const currentWaveDir = join(workspaceDir, `wave-${currentWave}`);

  // ── Load features (source of truth for metrics) ──
  const worktreeFeatures = join(currentWaveDir, 'worktree', 'sprints', `sprint-${sprintNumber}`, 'features.json');
  const repoFeatures = join(repoDir, 'sprints', `sprint-${sprintNumber}`, 'features.json');
  let features: Feature[] | null = null;
  const rawFeatures = await state.readJson<Feature[]>(worktreeFeatures) ?? await state.readJson<Feature[]>(repoFeatures);
  if (rawFeatures && Array.isArray(rawFeatures) && rawFeatures.length > 0) {
    features = rawFeatures;
  }

  // ── Section 2: Current wave detail ──
  await printWaveDetail(currentWave, currentData.steps, features);

  // ── Section 3: Last agent messages + engine log + timing ──
  const activeStep = findActiveStep(currentData.steps);
  if (activeStep) {
    const spawnInfo = await findActiveSpawn(activeStep, currentWaveDir);
    if (spawnInfo) {
      const messages = await readLastMessages(spawnInfo.jsonlPath, 3);
      printLastMessages(messages, spawnInfo.label);
    }
    const activity = await getActivityInfo(activeStep, spawnInfo?.jsonlPath ?? null, spawnInfo?.spawnJsonPath ?? null);
    printActivitySummary(activity, activeStep.loop);
  }

  // ── Print engine log (always, from current wave) ──
  const engineLogPath = join(currentWaveDir, 'engine.log');
  const engineMessages = await readLastEngineMessages(engineLogPath, 3);
  if (engineMessages.length > 0) {
    printLastMessages(engineMessages, 'engine');
  }

  // ── Section 4: Wave history ──

  const waveDataWithFeatures = new Map<number, { steps: StepInfo[]; features?: Feature[] }>();
  for (const [num, data] of waveData) {
    waveDataWithFeatures.set(num, { ...data, features: features ?? undefined });
  }
  printWaveHistory(waves, currentWave, waveDataWithFeatures);

  // ── Section 5: Features (last, since it's the longest) ──
  if (features) {
    printFeatures(features, sprintNumber);
  }

  console.log('');
}

main().catch((err) => {
  console.error(chalk.red(`\n  Fatal: ${err instanceof Error ? err.message : String(err)}\n`));
  process.exit(1);
});

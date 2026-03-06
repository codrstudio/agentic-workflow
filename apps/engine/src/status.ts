import { resolve, dirname, join } from 'node:path';
import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import { loadProjectConfig } from './core/bootstrap.js';
import { StateManager } from './core/state-manager.js';
import type { Feature } from './schemas/feature.js';
import type { WorkflowState } from './schemas/workflow-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const state = new StateManager();

// ── Types ──

interface SpawnMeta {
  task: string;
  agent: string;
  wave: number;
  step: number;
  pid: number;
  started_at: string;
  finished_at?: string;
  exit_code?: number;
  timed_out: boolean;
}

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
  dir: string;
  name: string;       // "step-01-pain-gain-analysis"
  index: number;       // 1-based
  label: string;       // "pain-gain-analysis"
  meta: SpawnMeta | null;
  loop: LoopState | null;
}

interface AgentMessage {
  text: string;
}

interface ActivityInfo {
  lastJsonlMtime: Date | null;   // file mtime of the active spawn.jsonl
  loopUpdatedAt: string | null;  // loop.json updated_at
  stepStartedAt: string | null;  // spawn.json started_at for the active step
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
  const steps: StepInfo[] = [];
  try {
    const entries = await readdir(waveDir);
    const stepDirs = entries.filter(e => e.startsWith('step-')).sort();
    for (const name of stepDirs) {
      const dir = join(waveDir, name);
      const match = name.match(/^step-(\d+)-(.+)$/);
      if (!match) continue;
      const index = parseInt(match[1]!, 10);
      const label = match[2]!;
      const meta = await state.readJson<SpawnMeta>(join(dir, 'spawn.json'));
      const loop = label === 'ralph-wiggum-loop'
        ? await state.readJson<LoopState>(join(dir, 'loop.json'))
        : null;
      steps.push({ dir, name, index, label, meta, loop });
    }
  } catch {
    // wave dir may not exist
  }
  return steps;
}

function findActiveStep(steps: StepInfo[]): StepInfo | null {
  // First: step with spawn.json but no finished_at (actively running)
  for (let i = steps.length - 1; i >= 0; i--) {
    const s = steps[i]!;
    if (s.meta && !s.meta.finished_at) return s;
    // For loop steps, check if loop is running
    if (s.loop && s.loop.status === 'running') return s;
  }
  // Fallback: last step with any metadata
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i]!.meta || steps[i]!.loop) return steps[i]!;
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

async function findActiveJsonl(step: StepInfo): Promise<{ path: string; label: string } | null> {
  // For loop steps, find the latest attempt dir by spawn.jsonl mtime
  if (step.loop) {
    try {
      const entries = await readdir(step.dir);
      const attemptDirs = entries.filter(e => e.match(/^F-\d{3}-attempt-\d+$/));
      const withMtime: { dir: string; path: string; mtime: Date }[] = [];
      for (const attemptDir of attemptDirs) {
        const jsonlPath = join(step.dir, attemptDir, 'spawn.jsonl');
        const mtime = await getFileMtime(jsonlPath);
        if (mtime) withMtime.push({ dir: attemptDir, path: jsonlPath, mtime });
      }
      withMtime.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
      if (withMtime.length > 0) {
        return { path: withMtime[0]!.path, label: `${step.name}, ${withMtime[0]!.dir}` };
      }
    } catch {
      // ignore
    }
  }

  // Direct spawn.jsonl
  const directPath = join(step.dir, 'spawn.jsonl');
  if (await state.fileExists(directPath)) {
    return { path: directPath, label: step.name };
  }

  return null;
}

async function getActivityInfo(step: StepInfo, jsonlPath: string | null): Promise<ActivityInfo> {
  const lastJsonlMtime = jsonlPath ? await getFileMtime(jsonlPath) : null;
  const loopUpdatedAt = step.loop?.updated_at ?? null;
  const stepStartedAt = step.meta?.started_at ?? null;
  return { lastJsonlMtime, loopUpdatedAt, stepStartedAt };
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

async function printWaveDetail(waveNum: number, steps: StepInfo[]): Promise<void> {
  const firstMeta = steps.find(s => s.meta)?.meta;
  const allFinished = steps.length > 0 && steps.every(s => s.meta?.finished_at);
  const anyRunning = steps.some(s => s.meta && !s.meta.finished_at) || steps.some(s => s.loop?.status === 'running');

  let waveStatus: string;
  let timeInfo: string;
  if (anyRunning && firstMeta) {
    waveStatus = chalk.yellow('running');
    timeInfo = chalk.gray(`(started ${formatRelativeTime(firstMeta.started_at)})`);
  } else if (allFinished) {
    waveStatus = chalk.green('completed');
    const lastMeta = [...steps].reverse().find(s => s.meta?.finished_at)?.meta;
    timeInfo = firstMeta && lastMeta?.finished_at
      ? chalk.gray(formatDuration(firstMeta.started_at, lastMeta.finished_at))
      : '';
  } else if (steps.length === 0) {
    waveStatus = chalk.gray('empty');
    timeInfo = '';
  } else {
    waveStatus = chalk.gray('unknown');
    timeInfo = '';
  }

  console.log('');
  console.log(`  ${chalk.cyan(`wave-${waveNum}`)}  ${waveStatus}  ${timeInfo}`);
  console.log('');
  console.log(`  ${chalk.gray('steps')}`);

  for (const step of steps) {
    const num = String(step.index).padStart(2, '0');
    const label = step.label.padEnd(26);

    if (!step.meta && !step.loop) {
      console.log(`    ${chalk.gray(num)} ${chalk.gray(label)} ${chalk.gray('--')}`);
      continue;
    }

    const meta = step.meta;
    let badge: string;
    let duration: string;
    let extra = '';

    if (meta && meta.finished_at) {
      badge = meta.exit_code === 0 ? chalk.green('OK') : chalk.red(`FAIL(${meta.exit_code})`);
      duration = chalk.gray(formatDuration(meta.started_at, meta.finished_at));
      if (meta.timed_out) extra = chalk.red(' TIMEOUT');
    } else if (meta || step.loop?.status === 'running') {
      badge = chalk.yellow('RUN');
      duration = meta ? chalk.gray(formatDuration(meta.started_at)) : '';
    } else {
      badge = chalk.gray('--');
      duration = '';
    }

    // Loop-specific info
    if (step.loop) {
      const l = step.loop;
      const skipped = l.total - l.remaining - l.done;
      let loopExtra = `(iter ${l.iteration}, ${l.done}/${l.total} done`;
      if (skipped > 0) loopExtra += `, ${skipped} skip`;
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

  console.log('');
  console.log(`  ${chalk.gray(`last agent output (${sourceLabel})`)}`);

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
    const firstMeta = steps.find(s => s.meta)?.meta;
    const lastMeta = [...steps].reverse().find(s => s.meta?.finished_at)?.meta;
    const allFinished = steps.length > 0 && steps.every(s => s.meta?.finished_at);

    let status: string;
    let duration: string;
    if (allFinished && firstMeta && lastMeta?.finished_at) {
      status = chalk.green('completed');
      duration = chalk.gray(formatDuration(firstMeta.started_at, lastMeta.finished_at));
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

  // ── Section 2: Current wave detail ──
  // printWaveDetail uses await internally for response.json, make it work
  await printWaveDetail(currentWave, currentData.steps);

  // ── Section 3: Last agent messages + timing ──
  const activeStep = findActiveStep(currentData.steps);
  if (activeStep) {
    const jsonlInfo = await findActiveJsonl(activeStep);
    if (jsonlInfo) {
      const messages = await readLastMessages(jsonlInfo.path, 3);
      printLastMessages(messages, jsonlInfo.label);
    }
    const activity = await getActivityInfo(activeStep, jsonlInfo?.path ?? null);
    printActivitySummary(activity, activeStep.loop);
  }

  // ── Section 4: Wave history ──
  const worktreeFeatures = join(workspaceDir, `wave-${currentWave}`, 'worktree', 'sprints', `sprint-${sprintNumber}`, 'features.json');
  const repoFeatures = join(repoDir, 'sprints', `sprint-${sprintNumber}`, 'features.json');
  let features: Feature[] | null = null;
  const rawFeatures = await state.readJson<Feature[]>(worktreeFeatures) ?? await state.readJson<Feature[]>(repoFeatures);
  if (rawFeatures && Array.isArray(rawFeatures) && rawFeatures.length > 0) {
    features = rawFeatures;
  }

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

import { join } from 'node:path';
import { readFile, writeFile, mkdir, access, readdir, rm, copyFile, stat } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { WorkflowSchema, type Workflow } from '../schemas/workflow.js';
import { ProjectConfigSchema, type ProjectConfig, type RepoConfig } from '../schemas/project.js';
import { type WorkflowState, type WorkflowStepState } from '../schemas/workflow-state.js';
import type { Plan } from '../schemas/tier.js';
import { WorktreeManager, type WorktreeInfo } from './worktree-manager.js';
import { AgentSpawner, type SpawnMeta } from './agent-spawner.js';
import { PlanResolver } from './plan-resolver.js';
import { StateManager, now } from './state-manager.js';
import { TemplateRenderer } from './template-renderer.js';

export interface ResolvedRepoConfig {
  url: string;
  source_branch: string;
  target_branch: string;
  auto_merge: boolean;
}

export interface BootstrapResult {
  projectConfig: ProjectConfig;
  workflow: Workflow;
  plan: Plan;
  workspaceDir: string;
  projectDir: string;
  repoDir: string;
  worktreeInfo: WorktreeInfo;
  waveNumber: number;
  waveDir: string;
  sprintNumber: number | null;
  sprintDir: string | null;
  resumed: boolean;
  resolvedRepoConfig: ResolvedRepoConfig | null;
}

const state = new StateManager();

function resolveRepoConfig(projectConfig: ProjectConfig): ResolvedRepoConfig | null {
  if (!projectConfig.repo) return null;
  const repo = projectConfig.repo;
  // String form (legacy): just a URL, no branch control
  if (typeof repo === 'string') return null;
  return {
    url: repo.url,
    source_branch: repo.source_branch,
    target_branch: repo.target_branch ?? `${projectConfig.slug}-harness`,
    auto_merge: repo.auto_merge,
  };
}

export async function loadProjectConfig(contextDir: string, slug: string): Promise<ProjectConfig> {
  const path = join(contextDir, 'projects', slug, 'project.json');
  const raw = await readFile(path, 'utf-8');
  return ProjectConfigSchema.parse(JSON.parse(raw));
}

export async function loadWorkflow(contextDir: string, slug: string): Promise<Workflow> {
  const path = join(contextDir, 'workflows', `${slug}.yaml`);
  const raw = await readFile(path, 'utf-8');
  const parsed = parseYaml(raw);
  const result = WorkflowSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid workflow "${slug}": ${result.error.message}`);
  }
  return result.data;
}

async function dirExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// bootstrapRepoViaAgent — spawns LLM in repoDir to handle git init/clone
// ---------------------------------------------------------------------------

const BootstrapRepoResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
});

const BOOTSTRAP_REPO_JSON_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
  },
  required: ['success'],
};

async function bootstrapRepoViaAgent(
  workspaceDir: string,
  repoDir: string,
  slug: string,
  projectConfig: ProjectConfig,
  tasksDir: string,
): Promise<void> {
  const outputDir = join(workspaceDir, 'ignite', 'step-00-bootstrap-repo');
  await mkdir(outputDir, { recursive: true });

  const repoUrl = typeof projectConfig.repo === 'string'
    ? projectConfig.repo
    : projectConfig.repo?.url ?? null;
  const repoConfig = typeof projectConfig.repo === 'object' ? projectConfig.repo : null;
  const sourceBranch = repoConfig?.source_branch ?? 'main';
  const targetBranch = repoConfig?.target_branch ?? `${slug}-harness`;

  const taskContent = await readFile(join(tasksDir, 'bootstrap-repo.md'), 'utf-8').catch(() => null);
  const renderer = new TemplateRenderer();
  const taskBody = taskContent ? renderer.parseFrontmatter(taskContent).body : '';

  const prompt = [
    taskBody,
    '',
    '## Variáveis',
    '',
    `- **repo_dir**: \`${repoDir}\``,
    `- **repo_url**: ${repoUrl ? `\`${repoUrl}\`` : '(nenhuma — criar repo local)'}`,
    `- **source_branch**: \`${sourceBranch}\``,
    `- **target_branch**: \`${targetBranch}\``,
    `- **slug**: \`${slug}\``,
    '',
    '---',
    '',
    'Ao concluir, responda com JSON: `{ "success": true }` ou `{ "success": false, "error": "motivo" }`.',
  ].join('\n');

  const spawner = new AgentSpawner();
  const meta: SpawnMeta = {
    task: 'bootstrap-repo',
    agent: 'direct',
    wave: 0,
    step: 0,
    parent_pid: process.pid,
    pid: 0,
    started_at: now(),
    timed_out: false,
    model_used: 'sonnet',
  };
  await spawner.writeSpawnMeta(outputDir, meta);

  const result = await spawner.spawnAgent({
    prompt,
    cwd: repoDir,
    outputDir,
    agentConfig: { model: 'sonnet', max_turns: 30 },
    jsonSchema: BOOTSTRAP_REPO_JSON_SCHEMA,
    onSpawn: (pid) => {
      meta.pid = pid;
      spawner.writeSpawnMeta(outputDir, meta);
    },
  });

  meta.pid = result.pid;
  meta.finished_at = now();
  meta.exit_code = result.code;
  meta.timed_out = result.timedOut;
  await spawner.writeSpawnMeta(outputDir, meta);

  if (result.code !== 0) {
    throw new Error(`bootstrap-repo agent failed with exit code ${result.code}`);
  }

  const parsed = BootstrapRepoResponseSchema.safeParse(result.response);
  if (!parsed.success || !parsed.data.success) {
    const msg = parsed.success && typeof parsed.data.error === 'string'
      ? parsed.data.error
      : 'bootstrap-repo agent reported failure';
    throw new Error(`bootstrap-repo failed: ${msg}`);
  }
}

export async function ensureWorkspace(
  contextDir: string,
  slug: string,
  workflowSlug: string,
  projectConfig: ProjectConfig,
): Promise<{ workspaceDir: string; repoDir: string }> {
  const workspaceDir = join(contextDir, 'workspaces', slug);
  const repoDir = join(workspaceDir, 'repo');

  await mkdir(workspaceDir, { recursive: true });

  // Write workspace.json if it doesn't exist
  const workspaceJsonPath = join(workspaceDir, 'workspace.json');
  if (!(await dirExists(workspaceJsonPath))) {
    await state.writeJson(workspaceJsonPath, {
      project: slug,
      workflow: workflowSlug,
      created_at: new Date().toISOString(),
    });
  }

  // Init or clone repo via agent
  if (!(await dirExists(repoDir))) {
    await mkdir(repoDir, { recursive: true });
    const tasksDir = join(contextDir, 'tasks');
    await bootstrapRepoViaAgent(workspaceDir, repoDir, slug, projectConfig, tasksDir);
  }

  return { workspaceDir, repoDir };
}

export async function detectNextWave(workspaceDir: string): Promise<number> {
  let maxWave = 0;
  try {
    const entries = await readdir(workspaceDir);
    for (const entry of entries) {
      const match = entry.match(/^wave-(\d+)$/);
      if (match) {
        const n = parseInt(match[1]!, 10);
        const wavePath = join(workspaceDir, entry);
        const hasState = await state.fileExists(join(wavePath, 'workflow-state.json'));
        if (!hasState) {
          // Empty/uninitialized wave dir — delete and skip
          try { await rm(wavePath, { recursive: true, force: true }); } catch { /* best effort */ }
          continue;
        }
        if (n > maxWave) maxWave = n;
      }
    }
  } catch {
    // Directory may not exist yet
  }
  return maxWave + 1;
}

/**
 * Resolve the sprint number for a given wave.
 * - If this wave already has a workflow-state.json with a sprint, return it (idempotent).
 * - Otherwise, find the max sprint from previous waves' workflow-state.json.
 * - Fallback: scan repo/sprints/ for existing sprint dirs (retrocompatibility).
 * - Return max + 1.
 */
export async function resolveSprintForWave(
  workspaceDir: string,
  repoDir: string,
  waveNumber: number,
): Promise<number> {
  // Check if this wave already has a sprint allocated
  const statePath = join(workspaceDir, `wave-${waveNumber}`, 'workflow-state.json');
  const existingState = await state.readJson<WorkflowState>(statePath);
  if (existingState && typeof existingState.sprint === 'number') {
    return existingState.sprint;
  }

  // Find max sprint from previous waves' workflow-state.json
  let maxSprint = 0;
  try {
    const entries = await readdir(workspaceDir);
    for (const entry of entries) {
      const match = entry.match(/^wave-(\d+)$/);
      if (match) {
        const waveNum = parseInt(match[1]!, 10);
        if (waveNum >= waveNumber) continue; // Only previous waves
        const ws = await state.readJson<WorkflowState>(join(workspaceDir, entry, 'workflow-state.json'));
        if (ws && typeof ws.sprint === 'number' && ws.sprint > maxSprint) {
          maxSprint = ws.sprint;
        }
      }
    }
  } catch {
    // workspace dir may not exist
  }

  // Fallback: scan repo/sprints/ for existing sprint dirs (retrocompatibility)
  if (maxSprint === 0) {
    try {
      const sprintEntries = await readdir(join(repoDir, 'sprints'));
      for (const entry of sprintEntries) {
        const match = entry.match(/^sprint-(\d+)$/);
        if (match) {
          const n = parseInt(match[1]!, 10);
          if (n > maxSprint) maxSprint = n;
        }
      }
    } catch {
      // sprints dir may not exist
    }
  }

  return maxSprint + 1;
}

/**
 * Check if the latest wave has an incomplete workflow-state.json (for resume).
 * Returns the wave number and state if resumable, null otherwise.
 */
export async function detectResumableWave(
  workspaceDir: string,
): Promise<{ waveNumber: number; workflowState: WorkflowState } | null> {
  let maxWave = 0;
  try {
    const entries = await readdir(workspaceDir);
    for (const entry of entries) {
      const match = entry.match(/^wave-(\d+)$/);
      if (match) {
        const n = parseInt(match[1]!, 10);
        if (n > maxWave) maxWave = n;
      }
    }
  } catch {
    return null;
  }

  if (maxWave === 0) return null;

  // Walk from highest to lowest, skipping empty waves (no workflow-state.json)
  for (let n = maxWave; n >= 1; n--) {
    const statePath = join(workspaceDir, `wave-${n}`, 'workflow-state.json');
    const ws = await state.readJson<WorkflowState>(statePath);
    if (!ws || !ws.steps) continue;

    // If workflow completed successfully, don't resume — start a new wave.
    if (ws.status === 'completed') {
      return null;
    }

    // 'stopped' is intentional pause — still resumable when user clicks "Retomar".
    // 'failed' is also resumable — retry failed steps instead of skipping to a new wave.
    // For stopped/failed waves, skipped steps will be reset to pending on resume.
    const hasIncomplete = ws.steps.some((s: WorkflowStepState) => s.status !== 'completed' && s.status !== 'skipped');
    const hasSkipped = ws.steps.some((s: WorkflowStepState) => s.status === 'skipped');
    const isStoppedOrFailed = ws.status === 'stopped' || ws.status === 'failed';

    if (!hasIncomplete && !(isStoppedOrFailed && hasSkipped)) {
      (ws as Record<string, unknown>).status = 'completed';
      const healPath = join(workspaceDir, `wave-${n}`, 'workflow-state.json');
      await state.writeJson(healPath, ws);
      return null;
    }

    return { waveNumber: n, workflowState: ws };
  }

  return null;
}

export async function setupWave(
  workspaceDir: string,
  repoDir: string,
  waveNumber: number,
  sprintNumber: number | null,
  workflow: Workflow,
  targetBranch?: string,
  projectTaskPath?: string,
): Promise<{ waveDir: string; worktreeInfo: WorktreeInfo; sprintDir: string | null }> {
  const waveDir = join(workspaceDir, `wave-${waveNumber}`);
  await mkdir(waveDir, { recursive: true });

  // Create worktree inside wave dir
  const worktreePath = join(waveDir, 'worktree');
  const branchName = `harness/wave-${waveNumber}`;
  const wtm = new WorktreeManager(repoDir);
  const worktreeInfo = wtm.create(worktreePath, branchName, targetBranch);

  // Apply worktree template (skills, HARNESS.md, CLAUDE.md section)
  await applyWorktreeTemplate(workspaceDir, worktreeInfo.path);

  // Run claude init to generate project understanding in CLAUDE.md
  runClaudeInit(worktreeInfo.path);

  // Ensure sprint scaffolding in worktree (only if workflow uses sprint)
  let sprintDir: string | null = null;
  if (sprintNumber != null) {
    sprintDir = join(worktreeInfo.path, 'sprints', `sprint-${sprintNumber}`);
    await mkdir(join(sprintDir, '1-brainstorming'), { recursive: true });
    await mkdir(join(sprintDir, '2-specs'), { recursive: true });
    await mkdir(join(sprintDir, '3-prps'), { recursive: true });

    // Snapshot TASK.md into sprint for historical reference
    if (projectTaskPath) {
      try {
        await copyFile(projectTaskPath, join(sprintDir, 'TASK.md'));
      } catch { /* TASK.md may not exist — skip silently */ }
    }
  }

  // Create workflow-state.json deterministically from workflow steps
  const workflowState: WorkflowState = {
    workflow: workflow.name,
    wave: waveNumber,
    sprint: sprintNumber ?? null,
    initialized_at: now(),
    status: 'running',
    steps: workflow.steps.map((step, i) => ({
      index: i + 1,
      task: stepTaskName(step),
      type: step.type,
      status: 'pending' as const,
      started_at: null,
      completed_at: null,
      exit_code: null,
    })),
  };
  await state.writeJson(join(waveDir, 'workflow-state.json'), workflowState);

  // Create workflow-progress.txt with initial entry
  const progressPath = join(waveDir, 'workflow-progress.txt');
  const ts = now().replace('T', ' ').replace('Z', '');
  await state.appendLine(
    progressPath,
    `[${ts}] Workflow initialized. ${workflow.steps.length} steps planned for wave ${waveNumber}.`,
  );

  return { waveDir, worktreeInfo, sprintDir };
}

// ---------------------------------------------------------------------------
// Worktree template — copies assets/worktree.template/ into worktree
// ---------------------------------------------------------------------------

const HARNESS_SECTION_START = '<!-- agentic-workflow:start -->';
const HARNESS_SECTION_END = '<!-- agentic-workflow:end -->';

async function copyDirRecursive(src: string, dest: string): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

/**
 * Inject or update the harness section inside CLAUDE.md.
 * If the file doesn't exist, create it with just the section.
 * If the file exists but has no section, prepend it.
 * If the file has the section, replace it in-place.
 */
async function upsertHarnessSection(
  worktreePath: string,
  templateDir: string,
): Promise<void> {
  const claudeMdPath = join(worktreePath, 'CLAUDE.md');
  const sectionSrc = join(templateDir, 'CLAUDE.md');

  let section: string;
  try {
    section = await readFile(sectionSrc, 'utf-8');
  } catch {
    return; // No template CLAUDE.md — skip
  }

  let existing = '';
  try {
    existing = await readFile(claudeMdPath, 'utf-8');
  } catch {
    // File doesn't exist — create with section only
    await writeFile(claudeMdPath, section, 'utf-8');
    return;
  }

  const startIdx = existing.indexOf(HARNESS_SECTION_START);
  const endIdx = existing.indexOf(HARNESS_SECTION_END);

  if (startIdx === -1 || endIdx === -1) {
    // Section markers not found — prepend
    await writeFile(claudeMdPath, section + '\n' + existing, 'utf-8');
  } else {
    // Replace existing section
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + HARNESS_SECTION_END.length);
    await writeFile(claudeMdPath, before + section.trim() + after, 'utf-8');
  }
}

/**
 * Copy the worktree template into the worktree.
 * - .claude/skills/ and HARNESS.md are overwritten (we own them).
 * - CLAUDE.md harness section is injected/updated without destroying user content.
 */
async function applyWorktreeTemplate(
  workspaceDir: string,
  worktreePath: string,
): Promise<void> {
  // workspaceDir = {root}/context/workspaces/{slug}
  const contextDir = join(workspaceDir, '..', '..');
  const templateDir = join(contextDir, '.templates', 'worktree');

  try {
    await stat(templateDir);
  } catch {
    return; // No template dir — skip
  }

  // 1. Copy .claude/skills/ (overwrite — we own these)
  const srcSkills = join(templateDir, '.claude', 'skills');
  try {
    await stat(srcSkills);
    await copyDirRecursive(srcSkills, join(worktreePath, '.claude', 'skills'));
  } catch { /* no skills dir */ }

  // 2. Copy HARNESS.md (overwrite — we own it)
  const srcHarness = join(templateDir, 'HARNESS.md');
  try {
    await stat(srcHarness);
    await copyFile(srcHarness, join(worktreePath, 'HARNESS.md'));
  } catch { /* no HARNESS.md */ }

  // 3. Upsert harness section in CLAUDE.md (preserve user content)
  await upsertHarnessSection(worktreePath, templateDir);
}

/**
 * Run `claude init` in the worktree to generate project understanding.
 * Best-effort: if claude CLI is not available or fails, continue silently.
 */
function runClaudeInit(worktreePath: string): void {
  try {
    execSync('claude init --yes', {
      cwd: worktreePath,
      stdio: 'pipe',
      timeout: 60_000,
    });
  } catch {
    // claude init may not be available or may fail — not blocking
  }
}

/**
 * Public — refresh worktree template (skills, HARNESS.md, CLAUDE.md section).
 * Called before each step so edits are picked up mid-wave.
 */
export async function refreshWorktreeSkills(
  workspaceDir: string,
  worktreePath: string,
): Promise<void> {
  await applyWorktreeTemplate(workspaceDir, worktreePath);
}

function stepTaskName(step: import('../schemas/workflow.js').WorkflowStep): string {
  switch (step.type) {
    case 'spawn-agent': return step.task;
    case 'ralph-wiggum-loop': return step.task;
    case 'chain-workflow': return `chain-${step.workflow}`;
    case 'spawn-workflow': return `spawn-${step.workflow}`;
    case 'stop-on-wave-limit': return 'stop-on-wave-limit';
  }
}

export function resolveProjectDir(contextDir: string, projectConfig: ProjectConfig): string {
  const targetFolder = projectConfig.target_folder ?? 'artifacts';
  return join(contextDir, 'projects', projectConfig.slug, targetFolder);
}

export async function writeEnginePid(workspaceDir: string, pid: number): Promise<void> {
  const workspaceJsonPath = join(workspaceDir, 'workspace.json');
  try {
    const raw = await readFile(workspaceJsonPath, 'utf-8');
    const data = JSON.parse(raw) as Record<string, unknown>;
    data['engine_pid'] = pid;
    await state.writeJson(workspaceJsonPath, data);
  } catch { /* ignore */ }
}

export async function bootstrap(
  contextDir: string,
  projectSlug: string,
  workflowSlug: string,
  planSlug?: string,
): Promise<BootstrapResult> {
  const projectConfig = await loadProjectConfig(contextDir, projectSlug);
  const workflow = await loadWorkflow(contextDir, workflowSlug);
  const resolvedRepoConfig = resolveRepoConfig(projectConfig);

  // Load plan: CLI arg > project config > fallback 'standard'
  const effectivePlanSlug = planSlug ?? projectConfig.plan ?? 'standard';
  const planResolver = new PlanResolver();
  const plansDir = join(contextDir, 'plans');
  const plan = await planResolver.loadPlan(plansDir, effectivePlanSlug);

  const { workspaceDir, repoDir } = await ensureWorkspace(
    contextDir,
    projectSlug,
    workflowSlug,
    projectConfig,
  );

  const projectDir = resolveProjectDir(contextDir, projectConfig);

  const needsSprint = workflow.sprint === true;

  // Check for resumable wave before creating a new one
  const resumable = await detectResumableWave(workspaceDir);
  if (resumable) {
    const waveDir = join(workspaceDir, `wave-${resumable.waveNumber}`);
    const worktreePath = join(waveDir, 'worktree');
    const branchName = `harness/wave-${resumable.waveNumber}`;

    // If worktree doesn't exist (engine died during setupWave), recreate it
    if (!(await dirExists(worktreePath))) {
      const wtm = new WorktreeManager(repoDir);
      wtm.create(worktreePath, branchName, resolvedRepoConfig?.target_branch);
    }

    // Refresh template on resume (picks up new/updated skills, HARNESS.md, CLAUDE.md section)
    await applyWorktreeTemplate(workspaceDir, worktreePath);

    const resumedSprint = resumable.workflowState.sprint ?? null;
    let sprintDir: string | null = null;
    if (resumedSprint != null) {
      sprintDir = join(worktreePath, 'sprints', `sprint-${resumedSprint}`);
      await mkdir(sprintDir, { recursive: true });
    }

    // Read HEAD from existing worktree
    let head = '';
    try {
      head = execSync('git rev-parse HEAD', { cwd: worktreePath, stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      // Worktree may not have commits yet
    }

    return {
      projectConfig,
      workflow,
      plan,
      workspaceDir,
      projectDir,
      repoDir,
      worktreeInfo: { path: worktreePath, branch: branchName, head, bare: false },
      waveNumber: resumable.waveNumber,
      waveDir,
      sprintNumber: resumedSprint,
      sprintDir,
      resumed: true,
      resolvedRepoConfig,
    };
  }

  const waveNumber = await detectNextWave(workspaceDir);
  const sprintNumber = needsSprint
    ? await resolveSprintForWave(workspaceDir, repoDir, waveNumber)
    : null;

  const projectTaskPath = join(contextDir, 'projects', projectSlug, 'TASK.md');
  const { waveDir, worktreeInfo, sprintDir } = await setupWave(
    workspaceDir,
    repoDir,
    waveNumber,
    sprintNumber,
    workflow,
    resolvedRepoConfig?.target_branch,
    projectTaskPath,
  );

  return {
    projectConfig,
    workflow,
    plan,
    workspaceDir,
    projectDir,
    repoDir,
    worktreeInfo,
    waveNumber,
    waveDir,
    sprintNumber,
    sprintDir,
    resumed: false,
    resolvedRepoConfig,
  };
}

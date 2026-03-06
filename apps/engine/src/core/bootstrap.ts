import { join } from 'node:path';
import { readFile, mkdir, access, readdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { WorkflowSchema, type Workflow } from '../schemas/workflow.js';
import { ProjectConfigSchema, type ProjectConfig, type RepoConfig } from '../schemas/project.js';
import { type WorkflowState, type WorkflowStepState } from '../schemas/workflow-state.js';
import { WorktreeManager, type WorktreeInfo } from './worktree-manager.js';
import { StateManager, now } from './state-manager.js';

export interface ResolvedRepoConfig {
  url: string;
  source_branch: string;
  target_branch: string;
  auto_merge: boolean;
}

export interface BootstrapResult {
  projectConfig: ProjectConfig;
  workflow: Workflow;
  workspaceDir: string;
  projectDir: string;
  repoDir: string;
  worktreeInfo: WorktreeInfo;
  waveNumber: number;
  waveDir: string;
  sprintNumber: number;
  sprintDir: string;
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

  // Init or clone repo
  if (!(await dirExists(repoDir))) {
    const repoUrl = typeof projectConfig.repo === 'string'
      ? projectConfig.repo
      : projectConfig.repo?.url;
    const repoConfig = typeof projectConfig.repo === 'object' ? projectConfig.repo : null;

    if (repoUrl) {
      const cloneBranch = repoConfig?.source_branch
        ? `-b "${repoConfig.source_branch}"`
        : '';
      execSync(`git clone ${cloneBranch} "${repoUrl}" repo`, {
        cwd: workspaceDir,
        stdio: 'pipe',
      });

      // If structured repo config, set up target branch
      if (repoConfig) {
        const resolved = resolveRepoConfig(projectConfig);
        if (resolved) {
          try {
            // Try checking out existing remote target branch
            execSync(`git checkout "${resolved.target_branch}"`, {
              cwd: repoDir,
              stdio: 'pipe',
            });
          } catch {
            // Target branch doesn't exist yet, create from source
            execSync(
              `git checkout -b "${resolved.target_branch}" "${resolved.source_branch}"`,
              { cwd: repoDir, stdio: 'pipe' },
            );
          }
        }
      }
    } else {
      await mkdir(repoDir, { recursive: true });
      execSync('git init', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "init: empty repository"', {
        cwd: repoDir,
        stdio: 'pipe',
      });
    }
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

  const statePath = join(workspaceDir, `wave-${maxWave}`, 'workflow-state.json');
  const ws = await state.readJson<WorkflowState>(statePath);
  if (!ws || !ws.steps) return null;

  // Resumable if any step is not completed (pending/running/failed)
  const hasIncomplete = ws.steps.some((s: WorkflowStepState) => s.status !== 'completed');
  if (!hasIncomplete) return null;

  return { waveNumber: maxWave, workflowState: ws };
}

export async function setupWave(
  workspaceDir: string,
  repoDir: string,
  waveNumber: number,
  sprintNumber: number,
  workflow: Workflow,
  targetBranch?: string,
): Promise<{ waveDir: string; worktreeInfo: WorktreeInfo; sprintDir: string }> {
  const waveDir = join(workspaceDir, `wave-${waveNumber}`);
  await mkdir(waveDir, { recursive: true });

  // Create worktree inside wave dir
  const worktreePath = join(waveDir, 'worktree');
  const branchName = `harness/wave-${waveNumber}`;
  const wtm = new WorktreeManager(repoDir);
  const worktreeInfo = wtm.create(worktreePath, branchName, targetBranch);

  // Ensure sprint scaffolding in worktree
  const sprintDir = join(worktreeInfo.path, 'sprints', `sprint-${sprintNumber}`);
  await mkdir(join(sprintDir, '1-brainstorming'), { recursive: true });
  await mkdir(join(sprintDir, '2-specs'), { recursive: true });
  await mkdir(join(sprintDir, '3-prps'), { recursive: true });

  // Create workflow-state.json deterministically from workflow steps
  const workflowState: WorkflowState = {
    workflow: workflow.name,
    wave: waveNumber,
    sprint: sprintNumber,
    initialized_at: now(),
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

function stepTaskName(step: import('../schemas/workflow.js').WorkflowStep): string {
  switch (step.type) {
    case 'spawn-agent': return step.task;
    case 'spawn-agent-call': return step.task;
    case 'ralph-wiggum-loop': return step.task;
    case 'chain-workflow': return `chain-${step.workflow}`;
    case 'spawn-workflow': return `spawn-${step.workflow}`;
  }
}

export function resolveProjectDir(contextDir: string, projectConfig: ProjectConfig): string {
  const targetFolder = projectConfig.target_folder ?? 'artifacts';
  return join(contextDir, 'projects', projectConfig.slug, targetFolder);
}

export async function bootstrap(
  contextDir: string,
  projectSlug: string,
  workflowSlug: string,
): Promise<BootstrapResult> {
  const projectConfig = await loadProjectConfig(contextDir, projectSlug);
  const workflow = await loadWorkflow(contextDir, workflowSlug);
  const resolvedRepoConfig = resolveRepoConfig(projectConfig);

  const { workspaceDir, repoDir } = await ensureWorkspace(
    contextDir,
    projectSlug,
    workflowSlug,
    projectConfig,
  );

  const projectDir = resolveProjectDir(contextDir, projectConfig);

  // Check for resumable wave before creating a new one
  const resumable = await detectResumableWave(workspaceDir);
  if (resumable) {
    const waveDir = join(workspaceDir, `wave-${resumable.waveNumber}`);
    const worktreePath = join(waveDir, 'worktree');
    const branchName = `harness/wave-${resumable.waveNumber}`;
    const sprintDir = join(
      worktreePath,
      'sprints',
      `sprint-${resumable.workflowState.sprint}`,
    );

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
      workspaceDir,
      projectDir,
      repoDir,
      worktreeInfo: { path: worktreePath, branch: branchName, head, bare: false },
      waveNumber: resumable.waveNumber,
      waveDir,
      sprintNumber: resumable.workflowState.sprint,
      sprintDir,
      resumed: true,
      resolvedRepoConfig,
    };
  }

  const waveNumber = await detectNextWave(workspaceDir);
  const sprintNumber = await resolveSprintForWave(workspaceDir, repoDir, waveNumber);

  const { waveDir, worktreeInfo, sprintDir } = await setupWave(
    workspaceDir,
    repoDir,
    waveNumber,
    sprintNumber,
    workflow,
    resolvedRepoConfig?.target_branch,
  );

  return {
    projectConfig,
    workflow,
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

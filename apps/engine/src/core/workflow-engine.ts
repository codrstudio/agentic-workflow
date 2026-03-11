import { join } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { StateManager, now } from './state-manager.js';
import { AgentSpawner, type SpawnMeta } from './agent-spawner.js';
import { FeatureLoop } from './feature-loop.js';
import { Notifier } from './notifier.js';
import { TemplateRenderer } from './template-renderer.js';
import { OperatorQueue } from './operator-queue.js';
import { PlanResolver } from './plan-resolver.js';
import { AcrInjector } from './acr-injector.js';
import { TokenUsageReporter } from './token-usage-reporter.js';
import { detectNextWave, resolveSprintForWave, setupWave } from './bootstrap.js';
import { WorkflowSchema, type Workflow, type WorkflowStep } from '../schemas/workflow.js';
import { TIER_MAP, type Plan, type TierSlug } from '../schemas/tier.js';
import type { WorkflowState } from '../schemas/workflow-state.js';
import type { Feature } from '../schemas/feature.js';
import type { EngineEvent, EngineEventType } from '../schemas/event.js';
import { ModelResolver } from './model-resolver.js';

export interface WorkflowRunnerContext {
  workflow: Workflow;
  plan: Plan;
  projectName: string;
  projectSlug: string;
  workflowSlug: string;
  workspaceDir: string;
  projectDir: string;
  repoDir: string;
  waveDir: string;
  worktreeDir: string;
  sprintDir: string;
  waveNumber: number;
  sprintNumber: number;
  agentsDir: string;
  tasksDir: string;
  workflowsDir: string;
  params?: Record<string, unknown>;
  sourceBranch?: string;
  targetBranch?: string;
  autoMerge?: boolean;
  waveLimit?: number;
  hubBaseUrl?: string;
}

export class WorkflowRunner {
  readonly state = new StateManager();
  readonly spawner = new AgentSpawner();
  readonly notifier = new Notifier();
  readonly renderer = new TemplateRenderer();
  readonly planResolver = new PlanResolver();
  readonly modelResolver = new ModelResolver();
  readonly acrInjector = new AcrInjector();
  readonly tokenReporter = new TokenUsageReporter();
  readonly operatorQueue = new OperatorQueue(this.state, this.spawner, this.notifier, this.renderer, this.acrInjector);

  private stopRequested = false;
  private backgroundPromises: Promise<unknown>[] = [];
  private _runCtx?: WorkflowRunnerContext;

  async waitForBackground(): Promise<void> {
    await Promise.allSettled(this.backgroundPromises);
    this.backgroundPromises = [];
  }

  async execute(ctx: WorkflowRunnerContext): Promise<{ exitCode: number; reason: string }> {
    const { workflow } = ctx;
    const statePath = join(ctx.waveDir, 'workflow-state.json');
    const progressPath = join(ctx.waveDir, 'workflow-progress.txt');

    this.stopRequested = false;
    this._runCtx = ctx;

    // Load existing workflow state (for resume support)
    const workflowState = await this.state.readJson<WorkflowState>(statePath);

    // Sanitize stale fields from steps that didn't finish cleanly
    if (workflowState?.steps) {
      let dirty = false;
      for (const step of workflowState.steps) {
        if (step.status !== 'completed' && step.status !== 'pending') {
          // Step was running/failed/interrupted when engine died — clear stale completion data
          if (step.completed_at !== null || step.exit_code !== null) {
            step.completed_at = null;
            step.exit_code = null;
            dirty = true;
          }
          // Also reset status to pending so it's cleanly re-executed
          if (step.status === 'running') {
            step.status = 'pending';
            step.started_at = null;
            dirty = true;
          }
        }
      }
      if (dirty) {
        await this.state.writeJson(statePath, workflowState);
      }
    }

    this.emitEvent('workflow:start', {
      workflow: workflow.name,
      project: ctx.projectName,
      steps: workflow.steps.length,
      wave: ctx.waveNumber,
    });

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        if (this.stopRequested) {
          this.emitEvent('workflow:end', { reason: 'stopped' });
          return { exitCode: 0, reason: 'stopped' };
        }

        const step = workflow.steps[i]!;
        const stepIndex = i + 1;
        const stepName = step.name ?? this.stepSlug(step);

        // Skip completed steps (resume support)
        const stepState = workflowState?.steps?.[i];
        if (stepState?.status === 'completed') {
          this.emitEvent('workflow:resume', {
            step: stepName,
            index: stepIndex,
            skipped: true,
          });
          continue;
        }

        // Update state → running (reset stale fields from previous execution)
        await this.updateStepState(statePath, i, {
          status: 'running',
          started_at: now(),
          completed_at: null,
          exit_code: null,
        });

        this.emitEvent('workflow:step:start', {
          step: stepName,
          type: step.type,
          index: stepIndex,
        });

        // Operator queue checkpoint — drain pending messages before each step
        await this.drainOperatorQueue(ctx);

        const result = await this.executeStep(step, stepIndex, ctx);

        // Update state — only mark completed if the step actually finished its work
        const finalStatus =
          result.reason === 'stopped' ? 'interrupted'
          : result.exitCode === 0 ? 'completed'
          : 'failed';
        await this.updateStepState(statePath, i, {
          status: finalStatus,
          completed_at: now(),
          exit_code: result.exitCode,
        });

        // Append to progress file
        const ts = now().replace('T', ' ').replace('Z', '');
        const statusLabel = finalStatus === 'completed' ? 'Completed' : `Failed (exit ${result.exitCode})`;
        await this.state.appendLine(
          progressPath,
          `[${ts}] Step ${stepIndex} (${stepName}): ${statusLabel}. ${result.reason}`,
        );

        this.emitEvent('workflow:step:end', {
          step: stepName,
          type: step.type,
          index: stepIndex,
          result: result.reason,
        });

        if (result.reason === 'decide:stop') {
          this.emitEvent('workflow:end', { reason: 'decide:stop', stopped_at_step: stepName });
          return { exitCode: 0, reason: 'decide:stop' };
        }

        if (result.exitCode !== 0) {
          this.emitEvent('workflow:end', { reason: `step_failed: ${stepName}` });
          return { exitCode: result.exitCode, reason: `step_failed: ${stepName}` };
        }
      }

      this.emitEvent('workflow:end', { reason: 'completed' });
      return { exitCode: 0, reason: 'completed' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emitEvent('workflow:end', { reason: `error: ${msg}` });
      return { exitCode: 1, reason: `error: ${msg}` };
    }
  }

  /**
   * Update a single step's state in workflow-state.json.
   */
  private async updateStepState(
    statePath: string,
    stepIdx: number,
    update: Partial<import('../schemas/workflow-state.js').WorkflowStepState>,
  ): Promise<void> {
    const ws = await this.state.readJson<WorkflowState>(statePath);
    if (!ws?.steps?.[stepIdx]) return;
    Object.assign(ws.steps[stepIdx], update);
    await this.state.writeJson(statePath, ws);
  }

  stop(): void {
    this.stopRequested = true;
  }

  /**
   * Cleanup resources (listeners, timers, connections).
   * Call this before process.exit() to ensure clean shutdown.
   */
  cleanup(): void {
    // Remove all listeners from notifier and other EventEmitters
    this.notifier.removeAllListeners();
  }

  /**
   * Enqueue an operator message for processing at the next checkpoint.
   */
  async enqueue(ctx: WorkflowRunnerContext, message: string, source?: string): Promise<void> {
    const queuePath = join(ctx.workspaceDir, 'operator-queue.jsonl');
    await this.operatorQueue.enqueue(queuePath, message, source);
  }

  /**
   * Drain pending operator messages if any exist.
   */
  private async drainOperatorQueue(ctx: WorkflowRunnerContext): Promise<void> {
    const queuePath = join(ctx.workspaceDir, 'operator-queue.jsonl');
    if (!(await this.operatorQueue.hasPending(queuePath))) return;
    await this.operatorQueue.drainAll(queuePath, {
      worktreeDir: ctx.worktreeDir,
      sprintDir: ctx.sprintDir,
      waveDir: ctx.waveDir,
      agentsDir: ctx.agentsDir,
      tasksDir: ctx.tasksDir,
      waveNumber: ctx.waveNumber,
      sprintNumber: ctx.sprintNumber,
      templateContext: this.buildTemplateContext(ctx),
      project: ctx.projectName,
      projectSlug: ctx.projectSlug,
    });
  }

  /**
   * Spawn merge agent in background for a wave.
   * Fire-and-forget: does not block the caller.
   */
  async spawnMergeBackground(ctx: WorkflowRunnerContext): Promise<void> {
    const mergeDir = join(ctx.waveDir, 'merge');
    const { prompt, agentName, frontmatter, taskFrontmatter } = await this.composePrompt('merge-worktree', ctx);
    const resolved = this.resolveSpawnModelEffort('merge-worktree', taskFrontmatter, frontmatter, ctx.plan);

    const resolvedModel = await this.modelResolver.resolve({
      profileModel: frontmatter.model as string | undefined,
      stepName: 'merge-worktree',
      projectSlug: ctx.projectSlug,
      workflowSlug: ctx.workflowSlug,
    });

    this.emitEvent('agent:spawn', { task: 'merge-worktree', agent: agentName, mode: 'background' });

    const meta: SpawnMeta = {
      task: 'merge-worktree',
      agent: agentName,
      wave: ctx.waveNumber,
      step: 0,
      parent_pid: process.pid,
      pid: 0,
      started_at: now(),
      timed_out: false,
      model_used: resolvedModel,
    };

    await this.spawner.writeSpawnMeta(mergeDir, meta);

    // Fire and forget
    this.spawner.spawnAgent({
      prompt,
      cwd: ctx.worktreeDir,
      outputDir: mergeDir,
      agentConfig: {
        allowedTools: frontmatter.allowedTools as string | undefined,
        max_turns: frontmatter.max_turns as number | undefined,
        model: resolved.model,
        effort: resolved.effort,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
      onSpawn: (pid) => {
        meta.pid = pid;
        this.spawner.writeSpawnMeta(mergeDir, meta);
      },
    }).then(async (result) => {
      meta.pid = result.pid;
      meta.finished_at = now();
      meta.exit_code = result.code;
      meta.timed_out = result.timedOut;
      await this.spawner.writeSpawnMeta(mergeDir, meta);
      this.emitEvent('agent:exit', {
        task: 'merge-worktree',
        exit_code: result.code,
        timed_out: result.timedOut,
      });

      // Report token usage
      await this.tokenReporter.report({
        projectSlug: ctx.projectSlug,
        outputDir: mergeDir,
        context: 'merge_agent',
        phase: 'merge-worktree',
        resolvedModel: resolved.model,
      });

      // After successful merge, update repo working directory to reflect latest state
      if (result.code === 0) {
        try {
          const checkoutRef = ctx.targetBranch ?? 'HEAD';
          execSync(`git checkout -f "${checkoutRef}"`, { cwd: ctx.repoDir, stdio: 'pipe' });
        } catch {
          // Best effort — repo snapshot update failure is non-fatal
        }
      }
    }).catch(() => {
      // Best effort — merge failure doesn't crash the engine
    });
  }

  /**
   * Spawn merge agent synchronously (awaitable).
   * Returns the exit code of the merge agent.
   */
  async spawnMerge(ctx: WorkflowRunnerContext): Promise<{ exitCode: number }> {
    const mergeDir = join(ctx.waveDir, 'merge');
    const { prompt, agentName, frontmatter, taskFrontmatter } = await this.composePrompt('merge-worktree', ctx);
    const resolved = this.resolveSpawnModelEffort('merge-worktree', taskFrontmatter, frontmatter, ctx.plan);

    const resolvedModel = await this.modelResolver.resolve({
      profileModel: frontmatter.model as string | undefined,
      stepName: 'merge-worktree',
      projectSlug: ctx.projectSlug,
      workflowSlug: ctx.workflowSlug,
    });

    this.emitEvent('agent:spawn', { task: 'merge-worktree', agent: agentName, mode: 'sync' });

    const meta: SpawnMeta = {
      task: 'merge-worktree',
      agent: agentName,
      wave: ctx.waveNumber,
      step: 0,
      parent_pid: process.pid,
      pid: 0,
      started_at: now(),
      timed_out: false,
      model_used: resolvedModel,
    };

    await this.spawner.writeSpawnMeta(mergeDir, meta);

    const result = await this.spawner.spawnAgent({
      prompt,
      cwd: ctx.worktreeDir,
      outputDir: mergeDir,
      agentConfig: {
        allowedTools: frontmatter.allowedTools as string | undefined,
        max_turns: frontmatter.max_turns as number | undefined,
        model: resolved.model,
        effort: resolved.effort,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
      onSpawn: (pid) => {
        meta.pid = pid;
        this.spawner.writeSpawnMeta(mergeDir, meta);
      },
    });

    meta.pid = result.pid;
    meta.finished_at = now();
    meta.exit_code = result.code;
    meta.timed_out = result.timedOut;
    await this.spawner.writeSpawnMeta(mergeDir, meta);

    this.emitEvent('agent:exit', {
      task: 'merge-worktree',
      exit_code: result.code,
      timed_out: result.timedOut,
    });

    // Report token usage
    await this.tokenReporter.report({
      projectSlug: ctx.projectSlug,
      outputDir: mergeDir,
      context: 'merge_agent',
      phase: 'merge-worktree',
      resolvedModel: resolved.model,
    });

    // After successful merge, update repo to target branch
    if (result.code === 0) {
      try {
        const checkoutRef = ctx.targetBranch ?? 'HEAD';
        execSync(`git checkout -f "${checkoutRef}"`, { cwd: ctx.repoDir, stdio: 'pipe' });
      } catch {
        // Best effort
      }
    }

    return { exitCode: result.code };
  }

  private stepSlug(step: WorkflowStep): string {
    switch (step.type) {
      case 'spawn-agent': return step.task;
      case 'spawn-agent-call': return step.task;
      case 'ralph-wiggum-loop': return 'ralph-wiggum-loop';
      case 'chain-workflow': return `chain-${step.workflow}`;
      case 'spawn-workflow': return `spawn-${step.workflow}`;
      case 'stop-on-wave-limit': return 'stop-on-wave-limit';
    }
  }

  private stepDirName(stepIndex: number, step: WorkflowStep): string {
    const nn = String(stepIndex).padStart(2, '0');
    return `step-${nn}-${this.stepSlug(step)}`;
  }

  /**
   * Resolve model/effort for a task spawn.
   * Priority: task frontmatter model/effort > plan tier > task tier > agent tier > env > fallback.
   */
  private resolveSpawnModelEffort(
    taskSlug: string,
    taskFrontmatter: import('../schemas/task.js').TaskFrontmatter,
    agentFrontmatter: Record<string, unknown>,
    plan: Plan,
    attempt: number = 1,
  ): { model?: string; effort?: string } {
    // 1. Task frontmatter model/effort (explicit escape hatch)
    if (taskFrontmatter.model || taskFrontmatter.effort) {
      return {
        model: taskFrontmatter.model,
        effort: taskFrontmatter.effort,
      };
    }

    // 2. Plan tier for this task (with escalation for attempt > 1)
    if (plan.tiers[taskSlug]) {
      return this.planResolver.resolveModelEffort(plan, taskSlug, attempt);
    }

    // 3. Task frontmatter tier
    if (taskFrontmatter.tier) {
      return TIER_MAP[taskFrontmatter.tier];
    }

    // 4. Agent frontmatter tier
    if (agentFrontmatter.tier && typeof agentFrontmatter.tier === 'string') {
      return TIER_MAP[agentFrontmatter.tier as TierSlug] ?? {};
    }

    // 5. Agent frontmatter model (legacy)
    if (agentFrontmatter.model) {
      return { model: agentFrontmatter.model as string };
    }

    // 6. Fallback — let spawner use env vars or its own defaults
    return {};
  }

  private buildTemplateContext(ctx: WorkflowRunnerContext): Record<string, string> {
    const templateContext: Record<string, string> = {
      workspace: ctx.workspaceDir,
      project: ctx.projectDir,
      repo: ctx.repoDir,
      worktree: ctx.worktreeDir,
      sprint: ctx.sprintDir,
      wave_dir: ctx.waveDir,
      wave_number: String(ctx.waveNumber),
      sprint_number: String(ctx.sprintNumber),
    };

    if (ctx.sourceBranch) templateContext.source_branch = ctx.sourceBranch;
    if (ctx.targetBranch) templateContext.target_branch = ctx.targetBranch;

    const params = ctx.params ?? {};
    for (const [key, val] of Object.entries(params)) {
      if (typeof val === 'string' && !(key in templateContext)) {
        templateContext[key] = val;
      }
    }

    return templateContext;
  }

  private async composePrompt(
    taskSlug: string,
    ctx: WorkflowRunnerContext,
  ): Promise<{ prompt: string; agentName: string; frontmatter: Record<string, unknown>; taskFrontmatter: import('../schemas/task.js').TaskFrontmatter }> {
    const task = await this.spawner.resolveTask(taskSlug, ctx.tasksDir);
    const agentName = task.frontmatter.agent;
    const { frontmatter, body: agentBody } = await this.spawner.resolveAgentProfile(agentName, ctx.agentsDir);

    const templateContext = this.buildTemplateContext(ctx);
    const agentPrompt = this.renderer.render(agentBody, templateContext);
    const taskPrompt = this.renderer.render(task.body, templateContext);
    const acrSection = await this.acrInjector.buildSection(ctx.projectSlug);
    const prompt = `${agentPrompt}\n\n---\n\n# Task: ${taskSlug}\n\n${taskPrompt}${acrSection}`;

    return { prompt, agentName, frontmatter, taskFrontmatter: task.frontmatter };
  }

  private async executeStep(
    step: WorkflowStep,
    stepIndex: number,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    switch (step.type) {
      case 'spawn-agent':
        if (step.task === 'merge-worktree') {
          return this.executeMergeWorktreeHybrid(stepIndex, ctx);
        }
        return this.executeSpawnAgent(step.task, step.model, stepIndex, ctx);

      case 'spawn-agent-call':
        return this.executeSpawnAgentCall(step.task, step.schema, step.stop_on, step.model, stepIndex, ctx);

      case 'ralph-wiggum-loop':
        return this.executeFeatureLoop(step.task, step.model, stepIndex, ctx);

      case 'chain-workflow':
        return this.executeChainWorkflow(step.workflow, ctx);

      case 'spawn-workflow':
        return this.executeSpawnWorkflow(step.workflow, ctx);

      case 'stop-on-wave-limit':
        return this.executeStopOnWaveLimit(ctx);

      default:
        return { exitCode: 1, reason: 'unknown step type' };
    }
  }

  private async executeSpawnAgent(
    taskSlug: string,
    stepModel: string | undefined,
    stepIndex: number,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    const stepDir = join(ctx.waveDir, this.stepDirName(stepIndex, { type: 'spawn-agent', task: taskSlug }));
    const { prompt, agentName, frontmatter, taskFrontmatter } = await this.composePrompt(taskSlug, ctx);
    const resolved = this.resolveSpawnModelEffort(taskSlug, taskFrontmatter, frontmatter, ctx.plan);

    const stepName = taskSlug;
    const resolvedModel = await this.modelResolver.resolve({
      stepModel,
      profileModel: frontmatter.model as string | undefined,
      stepName,
      projectSlug: ctx.projectSlug,
      workflowSlug: ctx.workflowSlug,
    });

    this.emitEvent('agent:spawn', { task: taskSlug, agent: agentName, model: resolvedModel });

    const meta: SpawnMeta = {
      task: taskSlug,
      agent: agentName,
      wave: ctx.waveNumber,
      step: stepIndex,
      parent_pid: process.pid,
      pid: 0,
      started_at: now(),
      timed_out: false,
      model_used: resolvedModel,
    };

    await this.spawner.writeSpawnMeta(stepDir, meta);

    const result = await this.spawner.spawnAgent({
      prompt,
      cwd: ctx.worktreeDir,
      outputDir: stepDir,
      agentConfig: {
        allowedTools: frontmatter.allowedTools as string | undefined,
        max_turns: frontmatter.max_turns as number | undefined,
        model: resolved.model,
        effort: resolved.effort,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
      onSpawn: (pid) => {
        meta.pid = pid;
        this.spawner.writeSpawnMeta(stepDir, meta);
      },
    });

    meta.pid = result.pid;
    meta.finished_at = now();
    meta.exit_code = result.code;
    meta.timed_out = result.timedOut;
    await this.spawner.writeSpawnMeta(stepDir, meta);

    this.emitEvent('agent:exit', {
      task: taskSlug,
      exit_code: result.code,
      timed_out: result.timedOut,
    });

    // Report token usage
    await this.tokenReporter.report({
      projectSlug: ctx.projectSlug,
      outputDir: stepDir,
      context: 'pipeline_phase',
      phase: taskSlug,
      resolvedModel: resolved.model,
    });

    return { exitCode: result.code, reason: result.code === 0 ? 'ok' : 'agent_failed' };
  }

  /**
   * Hybrid merge: attempts deterministic git merge, falls back to agent with JSON schema,
   * then verifies the SHA is in target branch log.
   */
  private async executeMergeWorktreeHybrid(
    stepIndex: number,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    const stepDir = join(ctx.waveDir, this.stepDirName(stepIndex, { type: 'spawn-agent', task: 'merge-worktree' }));
    const branchName = `harness/wave-${ctx.waveNumber}`;
    const targetBranch = ctx.targetBranch ?? 'main';
    const progressPath = join(ctx.waveDir, 'workflow-progress.txt');

    // LAYER 1: Deterministic merge attempt
    let mergedSha: string | null = null;
    let via: 'deterministic' | 'agent' = 'deterministic';

    try {
      execSync(`git -C "${ctx.repoDir}" checkout "${targetBranch}"`, { stdio: 'pipe' });
      execSync(`git -C "${ctx.repoDir}" merge "${branchName}" --no-ff --no-edit`, { stdio: 'pipe' });
      mergedSha = execSync(`git -C "${ctx.repoDir}" rev-parse HEAD`, { stdio: 'pipe' }).toString().trim();

      // Write spawn.json for deterministic layer
      const meta: SpawnMeta = {
        task: 'merge-worktree',
        agent: 'deterministic',
        wave: ctx.waveNumber,
        step: stepIndex,
        parent_pid: process.pid,
        pid: process.pid,
        started_at: now(),
        finished_at: now(),
        exit_code: 0,
        timed_out: false,
      };
      await this.spawner.writeSpawnMeta(stepDir, meta);
    } catch (err) {
      // Abort any in-progress merge
      try {
        execSync(`git -C "${ctx.repoDir}" merge --abort`, { stdio: 'pipe' });
      } catch {
        // Ignore abort errors
      }

      // LAYER 2: Fallback to agent with JSON schema
      via = 'agent';
      const { prompt, agentName, frontmatter, taskFrontmatter } = await this.composePrompt('merge-worktree', ctx);
      const resolved = this.resolveSpawnModelEffort('merge-worktree', taskFrontmatter, frontmatter, ctx.plan);

      this.emitEvent('agent:spawn', { task: 'merge-worktree', agent: agentName, mode: 'hybrid' });

      const meta: SpawnMeta = {
        task: 'merge-worktree',
        agent: agentName,
        wave: ctx.waveNumber,
        step: stepIndex,
        parent_pid: process.pid,
        pid: 0,
        started_at: now(),
        timed_out: false,
      };

      await this.spawner.writeSpawnMeta(stepDir, meta);

      const jsonSchema = {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          merged_sha: { type: 'string' },
          error: { type: 'string' },
        },
        required: ['success'],
      };

      const result = await this.spawner.spawnAgent({
        prompt,
        cwd: ctx.worktreeDir,
        outputDir: stepDir,
        agentConfig: {
          allowedTools: frontmatter.allowedTools as string | undefined,
          max_turns: frontmatter.max_turns as number | undefined,
          model: resolved.model,
          effort: resolved.effort,
        },
        timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
        jsonSchema,
        onSpawn: (pid) => {
          meta.pid = pid;
          this.spawner.writeSpawnMeta(stepDir, meta).catch(() => {});
        },
      });

      meta.pid = result.pid;
      meta.finished_at = now();
      meta.exit_code = result.code;
      meta.timed_out = result.timedOut;
      await this.spawner.writeSpawnMeta(stepDir, meta);

      this.emitEvent('agent:exit', {
        task: 'merge-worktree',
        exit_code: result.code,
        timed_out: result.timedOut,
      });

      // Fail hard if agent failed
      if (result.code !== 0) {
        await this.state.appendLine(progressPath, `[${now().replace('T', ' ').replace('Z', '')}] merge-worktree HARD FAIL: agent_failed (exit ${result.code})`);
        return { exitCode: 1, reason: 'merge_agent_failed' };
      }

      const response = result.response as { success?: boolean; merged_sha?: string; error?: string } | undefined;

      if (!response?.success) {
        await this.state.appendLine(progressPath, `[${now().replace('T', ' ').replace('Z', '')}] merge-worktree HARD FAIL: agent reported failure: ${response?.error || 'unknown'}`);
        return { exitCode: 1, reason: `merge_failed: ${response?.error || 'agent reported failure'}` };
      }

      mergedSha = response.merged_sha ?? null;
    }

    // LAYER 3: Verification - ensure SHA is in target branch log
    if (!mergedSha) {
      await this.state.appendLine(progressPath, `[${now().replace('T', ' ').replace('Z', '')}] merge-worktree HARD FAIL: no SHA to verify`);
      return { exitCode: 1, reason: 'merge_no_sha' };
    }

    try {
      const log = execSync(`git -C "${ctx.repoDir}" log "${targetBranch}" --oneline -50`, { stdio: 'pipe' }).toString();
      const shortSha = mergedSha.substring(0, 7);
      if (!log.includes(shortSha)) {
        await this.state.appendLine(progressPath, `[${now().replace('T', ' ').replace('Z', '')}] merge-worktree HARD FAIL: SHA ${mergedSha} not verified in ${targetBranch}`);
        return { exitCode: 1, reason: `merge_not_verified: SHA ${mergedSha} not in ${targetBranch}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.state.appendLine(progressPath, `[${now().replace('T', ' ').replace('Z', '')}] merge-worktree HARD FAIL: verify error: ${msg}`);
      return { exitCode: 1, reason: 'merge_verify_failed' };
    }

    // CLEANUP: Remove worktree and branch
    try {
      execSync(`git -C "${ctx.repoDir}" worktree remove "${ctx.worktreeDir}" --force`, { stdio: 'pipe' });
    } catch {
      // Best effort
    }

    try {
      execSync(`git -C "${ctx.repoDir}" branch -D "${branchName}"`, { stdio: 'pipe' });
    } catch {
      // Best effort
    }

    await this.state.appendLine(progressPath, `[${now().replace('T', ' ').replace('Z', '')}] merge-worktree via=${via} sha=${mergedSha}`);

    return { exitCode: 0, reason: 'ok' };
  }

  private async executeSpawnAgentCall(
    taskSlug: string,
    schema: Record<string, unknown>,
    stopOn: string,
    stepModel: string | undefined,
    stepIndex: number,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    const stepDir = join(ctx.waveDir, this.stepDirName(stepIndex, { type: 'spawn-agent-call', task: taskSlug, schema, stop_on: stopOn }));
    const { prompt, agentName, frontmatter, taskFrontmatter } = await this.composePrompt(taskSlug, ctx);
    const resolved = this.resolveSpawnModelEffort(taskSlug, taskFrontmatter, frontmatter, ctx.plan);

    const stepName = taskSlug;
    const resolvedModel = await this.modelResolver.resolve({
      stepModel,
      profileModel: frontmatter.model as string | undefined,
      stepName,
      projectSlug: ctx.projectSlug,
      workflowSlug: ctx.workflowSlug,
    });

    this.emitEvent('agent:spawn', { task: taskSlug, agent: agentName, mode: 'call', model: resolvedModel });

    const meta: SpawnMeta = {
      task: taskSlug,
      agent: agentName,
      wave: ctx.waveNumber,
      step: stepIndex,
      parent_pid: process.pid,
      pid: 0,
      started_at: now(),
      timed_out: false,
      model_used: resolvedModel,
    };

    await this.spawner.writeSpawnMeta(stepDir, meta);

    const result = await this.spawner.spawnAgent({
      prompt,
      cwd: ctx.worktreeDir,
      outputDir: stepDir,
      agentConfig: {
        allowedTools: frontmatter.allowedTools as string | undefined,
        max_turns: frontmatter.max_turns as number | undefined,
        model: resolved.model,
        effort: resolved.effort,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
      jsonSchema: schema,
      onSpawn: (pid) => {
        meta.pid = pid;
        this.spawner.writeSpawnMeta(stepDir, meta);
      },
    });

    meta.pid = result.pid;
    meta.finished_at = now();
    meta.exit_code = result.code;
    meta.timed_out = result.timedOut;
    await this.spawner.writeSpawnMeta(stepDir, meta);

    this.emitEvent('agent:exit', {
      task: taskSlug,
      exit_code: result.code,
      timed_out: result.timedOut,
      response: result.response,
    });

    // Report token usage
    await this.tokenReporter.report({
      projectSlug: ctx.projectSlug,
      outputDir: stepDir,
      context: 'pipeline_phase',
      phase: taskSlug,
      resolvedModel: resolved.model,
    });


    if (result.code !== 0) {
      return { exitCode: result.code, reason: 'agent_failed' };
    }

    try {
      const fn = new Function('return ' + stopOn)();
      const halt = fn(result.response);
      if (halt) {
        return { exitCode: 0, reason: 'decide:stop' };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[workflow] stop_on eval error: ${msg}`);
    }

    return { exitCode: 0, reason: 'decide:continue' };
  }

  private async executeFeatureLoop(
    taskSlug: string,
    stepModel: string | undefined,
    stepIndex: number,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    const stepDir = join(ctx.waveDir, this.stepDirName(stepIndex, { type: 'ralph-wiggum-loop', task: taskSlug }));
    await mkdir(stepDir, { recursive: true });

    // Reset stale in_progress features (from crash/restart)
    const featuresPath = join(ctx.sprintDir, 'features.json');
    const features = await this.state.readJson<Feature[]>(featuresPath);
    if (features && Array.isArray(features)) {
      let dirty = false;
      for (const f of features) {
        if (f.status === 'in_progress') {
          (f as Record<string, unknown>).status = 'failing';
          dirty = true;
        }
      }
      if (dirty) {
        await this.state.writeJson(featuresPath, features);
      }
    }

    const loop = new FeatureLoop(this.notifier, this.acrInjector, this.tokenReporter);
    return loop.execute(taskSlug, {
      worktreeDir: ctx.worktreeDir,
      sprintDir: ctx.sprintDir,
      stepDir,
      agentsDir: ctx.agentsDir,
      tasksDir: ctx.tasksDir,
      plan: ctx.plan,
      waveNumber: ctx.waveNumber,
      sprintNumber: ctx.sprintNumber,
      templateContext: this.buildTemplateContext(ctx),
      project: ctx.projectName,
      projectSlug: ctx.projectSlug,
      onCheckpoint: () => this.drainOperatorQueue(ctx),
    });
  }

  private async executeChainWorkflow(
    workflowSlug: string,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    const workflowPath = join(ctx.workflowsDir, `${workflowSlug}.yaml`);

    let raw: string;
    try {
      raw = await readFile(workflowPath, 'utf-8');
    } catch {
      return { exitCode: 1, reason: `workflow not found: ${workflowSlug}` };
    }

    const parsed = parseYaml(raw);
    const result = WorkflowSchema.safeParse(parsed);
    if (!result.success) {
      return { exitCode: 1, reason: `invalid workflow: ${result.error.message}` };
    }

    this.emitEvent('workflow:chain', {
      from: ctx.workflow.name,
      to: workflowSlug,
    });

    // Fire-and-forget: child runs in isolated runner so stopRequested/backgroundPromises don't collide
    const childRunner = new WorkflowRunner();
    childRunner.notifier.on('engine:event', (event) => {
      this.notifier.emitEngineEvent(event);
    });

    const childCtx: WorkflowRunnerContext = {
      ...ctx,
      workflow: result.data,
      workflowSlug,
    };

    const promise = childRunner.execute(childCtx)
      .then((r) => childRunner.waitForBackground().then(() => r))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.emitEvent('workflow:end', { reason: `chain_error: ${msg}`, workflow: workflowSlug });
      });

    this.backgroundPromises.push(promise);
    return { exitCode: 0, reason: 'chained' };
  }

  private async executeSpawnWorkflow(
    workflowSlug: string,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    const workflowPath = join(ctx.workflowsDir, `${workflowSlug}.yaml`);

    let raw: string;
    try {
      raw = await readFile(workflowPath, 'utf-8');
    } catch {
      return { exitCode: 1, reason: `workflow not found: ${workflowSlug}` };
    }

    const parsed = parseYaml(raw);
    const result = WorkflowSchema.safeParse(parsed);
    if (!result.success) {
      return { exitCode: 1, reason: `invalid workflow: ${result.error.message}` };
    }

    this.emitEvent('workflow:spawn', {
      from: ctx.workflow.name,
      to: workflowSlug,
    });

    // Bootstrap new wave (awaited — wave must exist on disk before returning so monitor sees it)
    const newWaveNumber = await detectNextWave(ctx.workspaceDir);
    const newSprintNumber = await resolveSprintForWave(ctx.workspaceDir, ctx.repoDir, newWaveNumber);
    const { waveDir, worktreeInfo, sprintDir } = await setupWave(
      ctx.workspaceDir,
      ctx.repoDir,
      newWaveNumber,
      newSprintNumber,
      result.data,
      ctx.targetBranch,
    );

    // Fire-and-forget: child runs in isolated runner so stopRequested/backgroundPromises don't collide
    const childRunner = new WorkflowRunner();
    childRunner.notifier.on('engine:event', (event) => {
      this.notifier.emitEngineEvent(event);
    });

    const childCtx: WorkflowRunnerContext = {
      ...ctx,
      workflow: result.data,
      workflowSlug,
      waveDir,
      worktreeDir: worktreeInfo.path,
      sprintDir,
      waveNumber: newWaveNumber,
      sprintNumber: newSprintNumber,
    };

    const promise = childRunner.execute(childCtx)
      .then((r) => childRunner.waitForBackground().then(() => r))
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.emitEvent('workflow:end', { reason: `spawn_error: ${msg}`, workflow: workflowSlug });
      });

    this.backgroundPromises.push(promise);
    return { exitCode: 0, reason: 'spawned' };
  }

  private executeStopOnWaveLimit(ctx: WorkflowRunnerContext): { exitCode: number; reason: string } {
    const limit = ctx.waveLimit;
    if (!limit) {
      return { exitCode: 0, reason: 'continue' };
    }

    if (ctx.waveNumber >= limit) {
      const msg = `wave limit reached: wave ${ctx.waveNumber} of ${limit}`;
      console.log(`\n  [stop-on-wave-limit] ${msg}\n`);
      this.emitEvent('workflow:end', { reason: msg });
      return { exitCode: 0, reason: 'decide:stop' };
    }

    console.log(`\n  [stop-on-wave-limit] wave ${ctx.waveNumber} of ${limit}, continuing\n`);
    return { exitCode: 0, reason: 'continue' };
  }

  private emitEvent(type: EngineEventType, data: Record<string, unknown>): void {
    this.notifier.emitEngineEvent({
      type,
      timestamp: now(),
      project_slug: this._runCtx?.projectSlug,
      wave_number: this._runCtx?.waveNumber,
      data,
    } as unknown as EngineEvent);
  }

  /**
   * Register a ModelOutputAttribution via POST to the hub API.
   * Fire-and-forget: failures are non-fatal.
   */
  private async registerAttribution(
    ctx: WorkflowRunnerContext,
    opts: {
      phase: string;
      step_name: string;
      model_used: string;
      spawn_dir?: string;
      feature_id?: string | null;
      artifact_id?: string | null;
    },
  ): Promise<void> {
    if (!ctx.hubBaseUrl || !ctx.projectSlug) return;
    try {
      await fetch(`${ctx.hubBaseUrl}/api/v1/hub/projects/${ctx.projectSlug}/model-attributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phase: opts.phase,
          step_name: opts.step_name,
          model_used: opts.model_used,
          spawn_dir: opts.spawn_dir ?? null,
          feature_id: opts.feature_id ?? null,
          artifact_id: opts.artifact_id ?? null,
        }),
      });
    } catch {
      // non-fatal: hub may not be available
    }
  }
}

export { WorkflowRunner as WorkflowEngine };

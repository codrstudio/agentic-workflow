import { join, basename } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
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
import { AgentConfigSchema } from '../schemas/config.js';

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

const STATUS_PROMPT_FRAGMENT = `\n\n---\n\nAo concluir, responda com um JSON. O campo \`success\` (boolean) deve ser true se você completou sua tarefa com sucesso, ou false se falhou. Se \`success\` for false, inclua \`error\` (string) com o motivo da falha.`;

const BASE_STATUS_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    error: { type: 'string' },
  },
  required: ['success'],
};

function mergeStatusSchema(custom?: Record<string, unknown>): Record<string, unknown> {
  if (!custom) return BASE_STATUS_SCHEMA;
  const customProps = (custom.properties as Record<string, unknown>) ?? {};
  const customRequired = (custom.required as string[]) ?? [];
  return {
    ...custom,
    properties: {
      success: { type: 'boolean' },
      error: { type: 'string' },
      ...customProps,
    },
    required: ['success', ...customRequired.filter((k) => k !== 'success')],
  };
}

const SpawnAgentResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
}).passthrough();

const MergeWorktreeResponseSchema = SpawnAgentResponseSchema.extend({
  merged_sha: z.string(),
});

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
  private _activeStepIdx: number | null = null;
  private _activeStatePath: string | null = null;

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
    if (workflowState) {
      let dirty = false;

      // Clear workflow-level stopped/failed status on resume
      if (workflowState.status === 'stopped' || workflowState.status === 'failed') {
        workflowState.status = 'running' as WorkflowState['status'];
        (workflowState as Record<string, unknown>)['stopped_reason'] = undefined;
        dirty = true;
      }

      for (const step of workflowState.steps) {
        if (step.status !== 'completed' && step.status !== 'pending') {
          // Step was running/failed/interrupted when engine died — clear stale completion data
          if (step.completed_at !== null || step.exit_code !== null) {
            step.completed_at = null;
            step.exit_code = null;
            dirty = true;
          }
          // Reset running/interrupted steps to pending so they're cleanly re-executed
          if (step.status === 'running' || step.status === 'interrupted') {
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

    // Pull latest changes from remote before starting the wave
    if (ctx.targetBranch) {
      await this.pullRepo(ctx);
    }

    try {
      for (let i = 0; i < workflow.steps.length; i++) {
        if (this.stopRequested) {
          // Do NOT write terminal status here — signal stops are resumable.
          // The step-level states (completed/pending) are sufficient for resume detection.
          this.emitEvent('workflow:end', { reason: 'stopped' });
          return { exitCode: 130, reason: 'stopped' };
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

        // Track active step so signal handler can mark it interrupted
        this._activeStepIdx = i;
        this._activeStatePath = statePath;

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

        const maxRetries = AgentConfigSchema.shape.max_retries.parse(undefined);
        let result!: { exitCode: number; reason: string; response?: unknown };
        let stepAttempt = 0;
        do {
          stepAttempt++;
          result = await this.executeStep(step, stepIndex, ctx);
          if (result.exitCode !== 0 && result.reason !== 'stopped' && stepAttempt < maxRetries) {
            this.emitEvent('workflow:step:retry', {
              step: stepName,
              type: step.type,
              index: stepIndex,
              attempt: stepAttempt,
              max_retries: maxRetries,
              reason: result.reason,
            });
          }
        } while (result.exitCode !== 0 && result.reason !== 'stopped' && stepAttempt < maxRetries);

        // Update state — only mark completed if the step actually finished its work
        const finalStatus =
          result.reason === 'stopped' ? 'interrupted'
          : result.exitCode === 0 ? 'completed'
          : 'failed';
        await this.updateStepState(statePath, i, {
          status: finalStatus,
          completed_at: now(),
          exit_code: result.exitCode,
          ...(result.response !== undefined ? { result: result.response as Record<string, unknown> } : {}),
        });

        // Step finished — no longer active
        this._activeStepIdx = null;

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
          // Mark remaining steps as skipped
          for (let j = i + 1; j < workflow.steps.length; j++) {
            await this.updateStepState(statePath, j, { status: 'skipped' });
          }
          await this.updateWorkflowStatus(statePath, 'stopped', `decide:stop at ${stepName}`);
          this.emitEvent('workflow:end', { reason: 'decide:stop', stopped_at_step: stepName });
          return { exitCode: 0, reason: 'decide:stop' };
        }

        if (result.exitCode !== 0) {
          await this.updateWorkflowStatus(statePath, 'failed', `step_failed: ${stepName}`);
          this.emitEvent('workflow:end', { reason: `step_failed: ${stepName}` });
          return { exitCode: result.exitCode, reason: `step_failed: ${stepName}` };
        }
      }

      await this.updateWorkflowStatus(statePath, 'completed');
      this.emitEvent('workflow:end', { reason: 'completed' });
      return { exitCode: 0, reason: 'completed' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.updateWorkflowStatus(statePath, 'failed', `error: ${msg}`);
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

  private async updateWorkflowStatus(
    statePath: string,
    status: 'running' | 'completed' | 'stopped' | 'failed',
    reason?: string,
  ): Promise<void> {
    const ws = await this.state.readJson<WorkflowState>(statePath);
    if (!ws) return;
    ws.status = status;
    if (reason) ws.stopped_reason = reason;
    await this.state.writeJson(statePath, ws);
  }

  stop(): void {
    this.stopRequested = true;
    // Immediately persist interrupted state for the running step so it
    // doesn't remain "running" in workflow-state.json if the process dies.
    this.markActiveStepInterrupted();
  }

  /**
   * Synchronously mark the currently running step as "interrupted" in
   * workflow-state.json.  Uses sync I/O because this runs inside a signal
   * handler where the process may exit at any moment.
   */
  private markActiveStepInterrupted(): void {
    if (this._activeStepIdx === null || !this._activeStatePath) return;
    try {
      const raw = readFileSync(this._activeStatePath, 'utf-8');
      const ws = JSON.parse(raw) as WorkflowState;
      const step = ws.steps?.[this._activeStepIdx];
      if (step && step.status === 'running') {
        step.status = 'interrupted';
        step.completed_at = now();
        writeFileSync(this._activeStatePath, JSON.stringify(ws, null, 2));
      }
    } catch {
      // Best-effort — don't crash the signal handler
    }
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
  ): Promise<{ exitCode: number; reason: string; response?: unknown }> {
    switch (step.type) {
      case 'spawn-agent':
        if (step.task === 'merge-worktree') {
          return this.executeMergeWorktreeHybrid(stepIndex, ctx);
        }
        return this.executeSpawnAgent(step.task, step.model, step.schema, step.stop_on, stepIndex, ctx);

      case 'ralph-wiggum-loop':
        return this.executeFeatureLoop(step.task, step.model, stepIndex, ctx, step.features_file);

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

  private async executeSpawnAgent<T extends z.infer<typeof SpawnAgentResponseSchema> = z.infer<typeof SpawnAgentResponseSchema>>(
    taskSlug: string,
    stepModel: string | undefined,
    customSchema: Record<string, unknown> | undefined,
    stopOn: string | undefined,
    stepIndex: number,
    ctx: WorkflowRunnerContext,
    responseSchema: z.ZodType<T> = SpawnAgentResponseSchema as z.ZodType<T>,
  ): Promise<{ exitCode: number; reason: string; response?: T }> {
    const stepDir = join(ctx.waveDir, this.stepDirName(stepIndex, { type: 'spawn-agent', task: taskSlug }));
    const attemptDir = await this.state.resolveNextAttemptDir(stepDir);
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

    const onChunkWritten = this.makeChunkDebounce(taskSlug, agentName);

    const meta: SpawnMeta = {
      task: taskSlug,
      agent: agentName,
      wave: ctx.waveNumber,
      step: stepIndex,
      attempt: parseInt(basename(attemptDir).split('-')[1]!, 10),
      parent_pid: process.pid,
      pid: 0,
      started_at: now(),
      timed_out: false,
      model_used: resolvedModel,
    };

    await this.spawner.writeSpawnMeta(attemptDir, meta);

    const result = await this.spawner.spawnAgent({
      prompt: prompt + STATUS_PROMPT_FRAGMENT,
      cwd: ctx.worktreeDir,
      outputDir: attemptDir,
      agentConfig: {
        allowedTools: frontmatter.allowedTools as string | undefined,
        max_turns: frontmatter.max_turns as number | undefined,
        model: resolved.model,
        effort: resolved.effort,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
      jsonSchema: mergeStatusSchema(customSchema),
      onSpawn: (pid) => {
        meta.pid = pid;
        this.spawner.writeSpawnMeta(attemptDir, meta);
      },
      onChunkWritten,
    });

    meta.pid = result.pid;
    meta.finished_at = now();
    meta.exit_code = result.code;
    meta.timed_out = result.timedOut;
    await this.spawner.writeSpawnMeta(attemptDir, meta);

    this.emitEvent('agent:exit', {
      task: taskSlug,
      exit_code: result.code,
      timed_out: result.timedOut,
      response: result.response,
    });

    // Report token usage
    await this.tokenReporter.report({
      projectSlug: ctx.projectSlug,
      outputDir: attemptDir,
      context: 'pipeline_phase',
      phase: taskSlug,
      resolvedModel: resolved.model,
    });

    if (result.code !== 0) {
      return { exitCode: result.code, reason: 'agent_failed', response: result.response as T | undefined };
    }

    const parsed = responseSchema.safeParse(result.response);
    if (!parsed.success || !parsed.data.success) {
      const msg = parsed.success && typeof parsed.data.error === 'string'
        ? parsed.data.error
        : 'agent reported failure without message';
      return { exitCode: 1, reason: `agent_failed: ${msg}`, response: result.response as T | undefined };
    }

    const response = parsed.data;

    if (stopOn) {
      try {
        const fn = new Function('return ' + stopOn)();
        if (fn(response)) return { exitCode: 0, reason: 'decide:stop', response };
      } catch (err) {
        console.error(`[workflow] stop_on eval error: ${err instanceof Error ? err.message : String(err)}`);
      }
      return { exitCode: 0, reason: 'decide:continue', response };
    }

    return { exitCode: 0, reason: 'ok', response };
  }

  /**
   * Hybrid pull: attempts deterministic git pull first; on conflict/failure, falls back to agent.
   * Runs before the step loop so the repo starts each wave with the latest remote changes.
   */
  private async pullRepo(ctx: WorkflowRunnerContext): Promise<void> {
    const targetBranch = ctx.targetBranch!;
    const progressPath = join(ctx.waveDir, 'workflow-progress.txt');

    // Layer 1 — Deterministic: git pull on the repo's target branch
    try {
      // Ensure we're on the target branch
      execSync(`git -C "${ctx.repoDir}" checkout "${targetBranch}"`, { stdio: 'pipe' });
      execSync(`git -C "${ctx.repoDir}" pull --ff-only origin "${targetBranch}"`, { stdio: 'pipe' });

      this.emitEvent('repo:pull', { branch: targetBranch, result: 'ok', via: 'deterministic' });
      await this.state.appendLine(
        progressPath,
        `[${now().replace('T', ' ').replace('Z', '')}] repo:pull via=deterministic branch=${targetBranch} result=ok`,
      );
      return;
    } catch (deterministicErr) {
      // --ff-only failed (diverged history or conflict) — try regular pull
      try {
        // Abort any partial merge left by the failed pull
        try { execSync(`git -C "${ctx.repoDir}" merge --abort`, { stdio: 'pipe' }); } catch { /* ignore */ }

        execSync(`git -C "${ctx.repoDir}" pull origin "${targetBranch}" --no-edit`, { stdio: 'pipe' });

        this.emitEvent('repo:pull', { branch: targetBranch, result: 'ok', via: 'deterministic' });
        await this.state.appendLine(
          progressPath,
          `[${now().replace('T', ' ').replace('Z', '')}] repo:pull via=deterministic branch=${targetBranch} result=ok (non-ff)`,
        );
        return;
      } catch (pullErr) {
        // Regular pull also failed — fall through to agent
        // Abort any in-progress merge before agent takes over
        try { execSync(`git -C "${ctx.repoDir}" merge --abort`, { stdio: 'pipe' }); } catch { /* ignore */ }
      }
    }

    // Layer 2 — Agent fallback: spawn agent to resolve conflicts
    this.emitEvent('repo:pull', { branch: targetBranch, result: 'conflict', via: 'agent' });

    try {
      // Re-attempt the pull so the agent has the conflict state to work with
      try {
        execSync(`git -C "${ctx.repoDir}" pull origin "${targetBranch}" --no-edit`, { stdio: 'pipe' });
      } catch {
        // Expected to fail again — agent will resolve
      }

      const pullDir = join(ctx.waveDir, 'repo-pull');
      await mkdir(pullDir, { recursive: true });

      const { prompt, agentName, frontmatter, taskFrontmatter } = await this.composePrompt('resolve-pull-conflicts', ctx);
      const resolved = this.resolveSpawnModelEffort('resolve-pull-conflicts', taskFrontmatter, frontmatter, ctx.plan);

      const resolvedModel = await this.modelResolver.resolve({
        profileModel: frontmatter.model as string | undefined,
        stepName: 'resolve-pull-conflicts',
        projectSlug: ctx.projectSlug,
        workflowSlug: ctx.workflowSlug,
      });

      this.emitEvent('agent:spawn', { task: 'resolve-pull-conflicts', agent: agentName });

      const meta: SpawnMeta = {
        task: 'resolve-pull-conflicts',
        agent: agentName,
        wave: ctx.waveNumber,
        step: 0,
        parent_pid: process.pid,
        pid: 0,
        started_at: now(),
        timed_out: false,
        model_used: resolvedModel,
      };
      await this.spawner.writeSpawnMeta(pullDir, meta);

      const result = await this.spawner.spawnAgent({
        prompt: prompt + STATUS_PROMPT_FRAGMENT,
        cwd: ctx.repoDir,
        outputDir: pullDir,
        agentConfig: {
          allowedTools: frontmatter.allowedTools as string | undefined,
          max_turns: frontmatter.max_turns as number | undefined,
          model: resolved.model,
          effort: resolved.effort,
        },
        jsonSchema: mergeStatusSchema(),
        onSpawn: (pid) => {
          meta.pid = pid;
          void this.spawner.writeSpawnMeta(pullDir, meta);
        },
      });

      meta.finished_at = now();
      meta.exit_code = result.code;
      meta.timed_out = result.timedOut;
      await this.spawner.writeSpawnMeta(pullDir, meta);

      if (result.code === 0) {
        const parsed = SpawnAgentResponseSchema.safeParse(result.response);
        if (parsed.success && parsed.data.success) {
          this.emitEvent('repo:pull', { branch: targetBranch, result: 'ok', via: 'agent' });
          await this.state.appendLine(
            progressPath,
            `[${now().replace('T', ' ').replace('Z', '')}] repo:pull via=agent branch=${targetBranch} result=ok`,
          );
          return;
        }
      }

      // Agent failed — log but don't block the wave (best-effort pull)
      const errMsg = `agent exit=${result.code} timed_out=${result.timedOut}`;
      this.emitEvent('repo:pull', { branch: targetBranch, result: 'failed', via: 'agent', error: errMsg });
      await this.state.appendLine(
        progressPath,
        `[${now().replace('T', ' ').replace('Z', '')}] repo:pull via=agent branch=${targetBranch} result=FAILED ${errMsg}`,
      );

      // Abort any partial merge so the wave can proceed with stale-but-clean state
      try { execSync(`git -C "${ctx.repoDir}" merge --abort`, { stdio: 'pipe' }); } catch { /* ignore */ }
    } catch (agentErr) {
      const errMsg = agentErr instanceof Error ? agentErr.message : String(agentErr);
      this.emitEvent('repo:pull', { branch: targetBranch, result: 'failed', error: errMsg });
      await this.state.appendLine(
        progressPath,
        `[${now().replace('T', ' ').replace('Z', '')}] repo:pull branch=${targetBranch} result=FAILED ${errMsg}`,
      );

      // Abort any partial merge so the wave can proceed
      try { execSync(`git -C "${ctx.repoDir}" merge --abort`, { stdio: 'pipe' }); } catch { /* ignore */ }
    }
  }

  /**
   * Hybrid merge: attempts deterministic git merge first; on any failure, falls back to agent.
   */
  private async executeMergeWorktreeHybrid(
    stepIndex: number,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string; response?: unknown }> {
    const stepDir = join(ctx.waveDir, this.stepDirName(stepIndex, { type: 'spawn-agent', task: 'merge-worktree' }));
    const branchName = `harness/wave-${ctx.waveNumber}`;
    const targetBranch = ctx.targetBranch ?? 'main';
    const progressPath = join(ctx.waveDir, 'workflow-progress.txt');

    await mkdir(stepDir, { recursive: true });
    const attemptDir = await this.state.resolveNextAttemptDir(stepDir);

    const sessionId = `wave-${ctx.waveNumber}-deterministic`;
    const model = 'engine/deterministic-merge';
    const startedAt = now();

    // Write initial spawn.json immediately so reuse-rule won't treat this attempt as unstarted
    // if the deterministic layer fails and agent fallback resolves its own next attempt dir.
    await this.spawner.writeSpawnMeta(attemptDir, {
      task: 'merge-worktree',
      agent: 'deterministic',
      wave: ctx.waveNumber,
      step: stepIndex,
      attempt: parseInt(basename(attemptDir).split('-')[1]!, 10),
      parent_pid: process.pid,
      pid: process.pid,
      started_at: startedAt,
      timed_out: false,
    });

    const jsonlPath = join(attemptDir, 'spawn.jsonl');
    const writeLine = (obj: unknown) => appendFileSync(jsonlPath, JSON.stringify(obj) + '\n', 'utf-8');

    const onChunkWritten = this.makeChunkDebounce('merge-worktree', 'deterministic');

    writeLine({ type: 'system', subtype: 'init', model, session_id: sessionId, cwd: ctx.repoDir });
    onChunkWritten();

    try {
      writeLine({ type: 'assistant', message: { model, content: [{ type: 'tool_use', id: 'det_1', name: 'Bash', input: { command: `git checkout ${targetBranch}` } }] } });
      onChunkWritten();
      execSync(`git -C "${ctx.repoDir}" checkout "${targetBranch}"`, { stdio: 'pipe' });

      writeLine({ type: 'assistant', message: { model, content: [{ type: 'tool_use', id: 'det_2', name: 'Bash', input: { command: `git merge ${branchName} --no-ff --no-edit` } }] } });
      onChunkWritten();
      execSync(`git -C "${ctx.repoDir}" merge "${branchName}" --no-ff --no-edit`, { stdio: 'pipe' });

      const mergedSha = execSync(`git -C "${ctx.repoDir}" rev-parse HEAD`, { stdio: 'pipe' }).toString().trim();

      writeLine({ type: 'assistant', message: { model, content: [{ type: 'text', text: `[deterministic] merge concluído — SHA: ${mergedSha}` }], stop_reason: 'end_turn' } });
      onChunkWritten();


      const meta: SpawnMeta = {
        task: 'merge-worktree',
        agent: 'deterministic',
        wave: ctx.waveNumber,
        step: stepIndex,
        attempt: parseInt(basename(attemptDir).split('-')[1]!, 10),
        parent_pid: process.pid,
        pid: process.pid,
        started_at: startedAt,
        finished_at: now(),
        exit_code: 0,
        timed_out: false,
      };
      await this.spawner.writeSpawnMeta(attemptDir, meta);

      // Cleanup worktree and branch
      try {
        execSync(`git -C "${ctx.repoDir}" worktree remove "${ctx.worktreeDir}" --force`, { stdio: 'pipe' });
      } catch { /* best effort */ }
      try {
        execSync(`git -C "${ctx.repoDir}" branch -D "${branchName}"`, { stdio: 'pipe' });
      } catch { /* best effort */ }

      await this.state.appendLine(progressPath, `[${now().replace('T', ' ').replace('Z', '')}] merge-worktree via=deterministic sha=${mergedSha}`);

      const response = MergeWorktreeResponseSchema.parse({ success: true, merged_sha: mergedSha });
      return { exitCode: 0, reason: 'ok', response };
    } catch (err) {
      writeLine({ type: 'assistant', message: { model, content: [{ type: 'text', text: `[deterministic] merge falhou — ${err instanceof Error ? err.message : String(err)}` }], stop_reason: 'end_turn' } });


      // Abort any in-progress merge before falling back to agent
      try {
        execSync(`git -C "${ctx.repoDir}" merge --abort`, { stdio: 'pipe' });
      } catch { /* ignore */ }

      writeLine({ type: 'system', subtype: 'fallback', model, content: '[deterministic→agent] iniciando fallback para agente' });
      onChunkWritten();

      const customSchema = {
        type: 'object',
        properties: {
          merged_sha: { type: 'string' },
        },
        required: ['merged_sha'],
      };

      return this.executeSpawnAgent(
        'merge-worktree',
        undefined,
        customSchema,
        undefined,
        stepIndex,
        ctx,
        MergeWorktreeResponseSchema,
      );
    }
  }

  private async executeFeatureLoop(
    taskSlug: string,
    stepModel: string | undefined,
    stepIndex: number,
    ctx: WorkflowRunnerContext,
    featuresFile?: string,
  ): Promise<{ exitCode: number; reason: string }> {
    const stepDir = join(ctx.waveDir, this.stepDirName(stepIndex, { type: 'ralph-wiggum-loop', task: taskSlug }));
    await mkdir(stepDir, { recursive: true });

    // Determine attempt number by counting existing attempt-N/ dirs
    const { readdir } = await import('node:fs/promises');
    const existing = await readdir(stepDir).catch(() => [] as string[]);
    const attemptNumber = existing.filter((d) => /^attempt-\d+$/.test(d)).length + 1;
    const loopDir = join(stepDir, `attempt-${attemptNumber}`);
    await mkdir(loopDir, { recursive: true });

    // Reset stale in_progress features (from crash/restart)
    const featuresFileName = featuresFile ?? 'features.json';
    const featuresPath = join(ctx.sprintDir, featuresFileName);
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
      stepDir: loopDir,
      agentsDir: ctx.agentsDir,
      tasksDir: ctx.tasksDir,
      plan: ctx.plan,
      waveNumber: ctx.waveNumber,
      sprintNumber: ctx.sprintNumber,
      templateContext: this.buildTemplateContext(ctx),
      project: ctx.projectName,
      projectSlug: ctx.projectSlug,
      onCheckpoint: () => this.drainOperatorQueue(ctx),
    }, {
      featuresFile: featuresFileName,
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

  private makeChunkDebounce(task: string, agent: string, delayMs = 2_000): () => void {
    let timer: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        this.emitEvent('agent:output', { task, agent, content_type: 'text', preview: '' });
      }, delayMs);
    };
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

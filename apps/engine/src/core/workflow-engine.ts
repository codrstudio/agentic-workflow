import { join } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';
import { StateManager, now } from './state-manager.js';
import { AgentSpawner, type SpawnMeta } from './agent-spawner.js';
import { FeatureLoop } from './feature-loop.js';
import { Notifier } from './notifier.js';
import { TemplateRenderer } from './template-renderer.js';
import { detectNextWave, resolveSprintForWave, setupWave } from './bootstrap.js';
import { WorkflowSchema, type Workflow, type WorkflowStep } from '../schemas/workflow.js';
import type { WorkflowState } from '../schemas/workflow-state.js';
import type { EngineEventType } from '../schemas/event.js';
import { ModelResolver } from './model-resolver.js';

export interface WorkflowRunnerContext {
  workflow: Workflow;
  projectName: string;
  projectSlug?: string;
  workflowSlug?: string;
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
}

export class WorkflowRunner {
  readonly state = new StateManager();
  readonly spawner = new AgentSpawner();
  readonly notifier = new Notifier();
  readonly renderer = new TemplateRenderer();
  readonly modelResolver = new ModelResolver();

  private stopRequested = false;

  async execute(ctx: WorkflowRunnerContext): Promise<{ exitCode: number; reason: string }> {
    const { workflow } = ctx;
    const statePath = join(ctx.waveDir, 'workflow-state.json');
    const progressPath = join(ctx.waveDir, 'workflow-progress.txt');

    this.stopRequested = false;

    // Load existing workflow state (for resume support)
    const workflowState = await this.state.readJson<WorkflowState>(statePath);

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

        // Update state → running
        await this.updateStepState(statePath, i, {
          status: 'running',
          started_at: now(),
        });

        this.emitEvent('workflow:step:start', {
          step: stepName,
          type: step.type,
          index: stepIndex,
        });

        const result = await this.executeStep(step, stepIndex, ctx);

        // Update state → completed/failed
        const finalStatus = result.exitCode === 0 ? 'completed' : 'failed';
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
   * Spawn merge agent in background for a wave.
   * Fire-and-forget: does not block the caller.
   */
  async spawnMergeBackground(ctx: WorkflowRunnerContext): Promise<void> {
    const mergeDir = join(ctx.waveDir, 'merge');
    const { prompt, agentName, frontmatter } = await this.composePrompt('merge-worktree', ctx);

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
        model: resolvedModel,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
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
    const { prompt, agentName, frontmatter } = await this.composePrompt('merge-worktree', ctx);

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
        model: resolvedModel,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
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
    }
  }

  private stepDirName(stepIndex: number, step: WorkflowStep): string {
    const nn = String(stepIndex).padStart(2, '0');
    return `step-${nn}-${this.stepSlug(step)}`;
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
  ): Promise<{ prompt: string; agentName: string; frontmatter: Record<string, unknown> }> {
    const task = await this.spawner.resolveTask(taskSlug, ctx.tasksDir);
    const agentName = task.frontmatter.agent;
    const { frontmatter, body: agentBody } = await this.spawner.resolveAgentProfile(agentName, ctx.agentsDir);

    const templateContext = this.buildTemplateContext(ctx);
    const agentPrompt = this.renderer.render(agentBody, templateContext);
    const taskPrompt = this.renderer.render(task.body, templateContext);
    const prompt = `${agentPrompt}\n\n---\n\n# Task: ${taskSlug}\n\n${taskPrompt}`;

    return { prompt, agentName, frontmatter };
  }

  private async executeStep(
    step: WorkflowStep,
    stepIndex: number,
    ctx: WorkflowRunnerContext,
  ): Promise<{ exitCode: number; reason: string }> {
    switch (step.type) {
      case 'spawn-agent':
        return this.executeSpawnAgent(step.task, step.model, stepIndex, ctx);

      case 'spawn-agent-call':
        return this.executeSpawnAgentCall(step.task, step.schema, step.stop_on, step.model, stepIndex, ctx);

      case 'ralph-wiggum-loop':
        return this.executeFeatureLoop(step.task, step.model, stepIndex, ctx);

      case 'chain-workflow':
        return this.executeChainWorkflow(step.workflow, ctx);

      case 'spawn-workflow':
        return this.executeSpawnWorkflow(step.workflow, ctx);

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
    const { prompt, agentName, frontmatter } = await this.composePrompt(taskSlug, ctx);

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
        model: resolvedModel,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
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

    return { exitCode: result.code, reason: result.code === 0 ? 'ok' : 'agent_failed' };
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
    const { prompt, agentName, frontmatter } = await this.composePrompt(taskSlug, ctx);

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
        model: resolvedModel,
      },
      timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
      jsonSchema: schema,
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

    const loop = new FeatureLoop(this.notifier);
    return loop.execute(taskSlug, {
      worktreeDir: ctx.worktreeDir,
      sprintDir: ctx.sprintDir,
      stepDir,
      agentsDir: ctx.agentsDir,
      tasksDir: ctx.tasksDir,
      waveNumber: ctx.waveNumber,
      sprintNumber: ctx.sprintNumber,
      templateContext: this.buildTemplateContext(ctx),
      project: ctx.projectName,
      stepModel,
      projectSlug: ctx.projectSlug,
      workflowSlug: ctx.workflowSlug,
      modelResolver: this.modelResolver,
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

    // Execute chained workflow in the same wave context
    return this.execute({
      ...ctx,
      workflow: result.data,
    });
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

    // Bootstrap new wave for the spawned workflow
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

    // Execute spawned workflow in its own wave context
    return this.execute({
      ...ctx,
      workflow: result.data,
      waveDir,
      worktreeDir: worktreeInfo.path,
      sprintDir,
      waveNumber: newWaveNumber,
      sprintNumber: newSprintNumber,
    });
  }

  private emitEvent(type: EngineEventType, data: Record<string, unknown>): void {
    this.notifier.emitEngineEvent({
      type,
      timestamp: now(),
      data,
    });
  }
}

export { WorkflowRunner as WorkflowEngine };

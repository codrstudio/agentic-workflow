import { join } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { StateManager, now } from './state-manager.js';
import { AgentSpawner, type SpawnMeta } from './agent-spawner.js';
import { FeatureSelector } from './feature-selector.js';
import { GutterDetector, type RollbackMode } from './gutter-detector.js';
import { Notifier } from './notifier.js';
import { TemplateRenderer } from './template-renderer.js';
import type { Feature } from '../schemas/feature.js';
import type { EngineEventType } from '../schemas/event.js';
import type { LoopState } from '../schemas/loop-state.js';

export interface FeatureLoopContext {
  worktreeDir: string;
  sprintDir: string;
  stepDir: string;
  agentsDir: string;
  tasksDir: string;
  waveNumber: number;
  sprintNumber: number;
  templateContext: Record<string, string>;
  project?: string;
}

export interface FeatureLoopOptions {
  maxRetries?: number;
  maxIterations?: number;
  maxFeatures?: number;
  sleepBetween?: number;
  timeoutMs?: number;
  rollbackMode?: RollbackMode;
}

export class FeatureLoop {
  readonly state = new StateManager();
  readonly spawner = new AgentSpawner();
  readonly selector = new FeatureSelector();
  readonly gutter = new GutterDetector();
  readonly renderer = new TemplateRenderer();

  private stopRequested = false;
  private iteration = 0;
  private featuresDone = 0;
  private startedAt = now();

  constructor(readonly notifier: Notifier) {}

  async execute(
    taskSlug: string,
    ctx: FeatureLoopContext,
    opts: FeatureLoopOptions = {},
  ): Promise<{ exitCode: number; reason: string }> {
    const { sprintDir, stepDir, worktreeDir } = ctx;
    const featuresPath = join(sprintDir, 'features.json');
    const loopStatePath = join(stepDir, 'loop.json');

    const maxRetries = opts.maxRetries ?? 5;
    const maxIterations = Number(process.env.MAX_ITERATIONS) || opts.maxIterations || 0;
    const maxFeatures = Number(process.env.MAX_FEATURES) || opts.maxFeatures || 0;
    const sleepBetween = Number(process.env.SLEEP_BETWEEN) || opts.sleepBetween || 5;
    const timeoutMs = Number(process.env.AGENT_TIMEOUT_MS) || opts.timeoutMs || 0;
    const rollbackMode = opts.rollbackMode ?? 'stash';

    this.iteration = 0;
    this.featuresDone = 0;
    this.startedAt = now();
    this.stopRequested = false;

    // Resolve task and agent profile once
    const task = await this.spawner.resolveTask(taskSlug, ctx.tasksDir);
    const agentName = task.frontmatter.agent;
    const { frontmatter: agentFrontmatter, body: agentBody } = await this.spawner.resolveAgentProfile(agentName, ctx.agentsDir);

    const writeLoopState = async (overrides: Partial<LoopState> = {}) => {
      const features = await this.state.loadFeatures(featuresPath) as Feature[];
      const passing = features.filter((f) => f.status === 'passing').length;
      const skipped = features.filter((f) => f.status === 'skipped').length;
      const loopState: LoopState = {
        status: overrides.status ?? (this.iteration === 0 ? 'starting' : 'running'),
        pid: process.pid,
        iteration: this.iteration,
        total: features.length,
        done: passing,
        remaining: features.length - passing - skipped,
        features_done: this.featuresDone,
        started_at: this.startedAt,
        updated_at: now(),
        max_iterations: maxIterations || null,
        max_features: maxFeatures || null,
        ...overrides,
      };
      await this.state.writeJson(loopStatePath, loopState);
      return loopState;
    };

    await writeLoopState({ status: 'starting' });

    const initialFeatures = await this.state.loadFeatures(featuresPath) as Feature[];
    await this.emitEvent('loop:start', ctx, { task: taskSlug, total: initialFeatures.length });

    const checkStop = async (): Promise<boolean> => {
      if (this.stopRequested) return true;
      return this.state.fileExists(join(stepDir, '.stop'));
    };

    try {
      while (true) {
        this.iteration++;

        if (maxIterations > 0 && this.iteration > maxIterations) {
          await writeLoopState({ status: 'exited', exit_reason: 'iteration_limit' });
          await this.emitEvent('loop:end', ctx, { reason: 'iteration_limit' });
          return { exitCode: 1, reason: 'iteration_limit' };
        }

        if (maxFeatures > 0 && this.featuresDone >= maxFeatures) {
          await writeLoopState({ status: 'exited', exit_reason: 'feature_limit' });
          await this.emitEvent('loop:end', ctx, { reason: 'feature_limit' });
          return { exitCode: 0, reason: 'feature_limit' };
        }

        if (await checkStop()) {
          await writeLoopState({ status: 'exited', exit_reason: 'stopped' });
          await this.emitEvent('loop:end', ctx, { reason: 'stopped' });
          return { exitCode: 1, reason: 'stopped' };
        }

        const features = await this.state.loadFeatures(featuresPath) as Feature[];
        this.selector.computeBlocked(features);
        await this.state.saveFeatures(featuresPath, features);

        const feature = this.selector.selectNextFeature(features);

        if (!feature) {
          if (this.selector.hasImpossibleDeps(features)) {
            await writeLoopState({ status: 'exited', exit_reason: 'deps_impossible' });
            await this.emitEvent('loop:end', ctx, { reason: 'deps_impossible' });
            return { exitCode: 1, reason: 'deps_impossible' };
          }
          await writeLoopState({ status: 'exited', exit_reason: 'completed' });
          await this.emitEvent('loop:end', ctx, { reason: 'completed', features_done: this.featuresDone });
          return { exitCode: 0, reason: 'completed' };
        }

        (feature as Record<string, unknown>).status = 'in_progress';
        await this.state.saveFeatures(featuresPath, features);

        const retries = ((feature as Record<string, unknown>).retries as number | undefined) ?? 0;
        const attempt = retries + 1;
        const attemptDir = join(stepDir, `${feature.id}-attempt-${attempt}`);
        await mkdir(attemptDir, { recursive: true });

        await writeLoopState({ feature_id: feature.id, current_feature: feature.name });

        await this.emitEvent('feature:start', ctx, {
          feature_id: feature.id,
          feature_name: feature.name,
          iteration: this.iteration,
          attempt,
        });

        await this.emitEvent('loop:iteration', ctx, {
          iteration: this.iteration,
          feature_id: feature.id,
        });

        // Compose prompt: agent body + task body with feature context
        const agentPrompt = this.renderer.render(agentBody, ctx.templateContext);
        const taskPrompt = this.renderer.render(task.body, ctx.templateContext);
        const featureContext = `\n\n## Feature: ${feature.id} — ${feature.name}\n\n${feature.description}\n\nTests:\n${(feature.tests ?? []).map((t) => `- ${t}`).join('\n')}`;
        const prompt = `${agentPrompt}\n\n---\n\n# Task: ${taskSlug}\n\n${taskPrompt}${featureContext}`;

        const meta: SpawnMeta = {
          task: taskSlug,
          agent: agentName,
          wave: ctx.waveNumber,
          step: 0,
          feature: feature.id,
          attempt,
          parent_pid: process.pid,
          pid: 0,
          started_at: now(),
          timed_out: false,
        };

        await this.spawner.writeSpawnMeta(attemptDir, meta);

        const result = await this.spawner.spawnAgent({
          prompt,
          cwd: worktreeDir,
          outputDir: attemptDir,
          agentConfig: {
            allowedTools: agentFrontmatter.allowedTools as string | undefined,
            max_turns: agentFrontmatter.max_turns as number | undefined,
            model: agentFrontmatter.model as string | undefined,
          },
          timeoutMs: timeoutMs > 0 ? timeoutMs : undefined,
        });

        meta.pid = result.pid;
        meta.finished_at = now();
        meta.exit_code = result.code;
        meta.timed_out = result.timedOut;
        await this.spawner.writeSpawnMeta(attemptDir, meta);

        // Re-read features (agent may have mutated them)
        const updatedFeatures = await this.state.loadFeatures(featuresPath) as Feature[];
        const updatedFeature = updatedFeatures.find((f) => f.id === feature.id);

        if (updatedFeature?.status === 'passing') {
          this.featuresDone++;
          await this.emitEvent('feature:pass', ctx, {
            feature_id: feature.id,
            feature_name: feature.name,
            iteration: this.iteration,
            features_done: this.featuresDone,
          });
        } else {
          const newRetries = retries + 1;
          if (updatedFeature) {
            (updatedFeature as Record<string, unknown>).retries = newRetries;
          }

          const gutterAction = this.gutter.evaluate(newRetries, maxRetries);

          if (gutterAction.action === 'skip') {
            if (updatedFeature) {
              this.gutter.applyAction(updatedFeature, gutterAction, rollbackMode, worktreeDir);
            }
            await this.emitEvent('feature:skip', ctx, {
              feature_id: feature.id,
              feature_name: feature.name,
              reason: gutterAction.reason,
            });
            await this.emitEvent('gutter:skip', ctx, { feature_id: feature.id, retries: newRetries });
          } else if (gutterAction.action === 'rollback_and_retry') {
            if (updatedFeature) {
              this.gutter.applyAction(updatedFeature, gutterAction, rollbackMode, worktreeDir);
            }
            await this.emitEvent('gutter:rollback', ctx, {
              feature_id: feature.id,
              retries: newRetries,
              rollback_result: gutterAction.rollbackResult,
            });
          } else {
            await this.emitEvent('feature:fail', ctx, {
              feature_id: feature.id,
              feature_name: feature.name,
              retries: newRetries,
            });
            await this.emitEvent('gutter:retry', ctx, { feature_id: feature.id, retries: newRetries });
          }

          await this.state.saveFeatures(featuresPath, updatedFeatures);
        }

        if (await checkStop()) {
          await writeLoopState({ status: 'exited', exit_reason: 'stopped' });
          await this.emitEvent('loop:end', ctx, { reason: 'stopped' });
          return { exitCode: 1, reason: 'stopped' };
        }

        if (sleepBetween > 0) {
          for (let s = 0; s < sleepBetween; s++) {
            if (await checkStop()) {
              await writeLoopState({ status: 'exited', exit_reason: 'stopped' });
              await this.emitEvent('loop:end', ctx, { reason: 'stopped' });
              return { exitCode: 1, reason: 'stopped' };
            }
            await this.sleep(1000);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await writeLoopState({ status: 'exited', exit_reason: `error: ${msg}` });
      await this.emitEvent('loop:end', ctx, { reason: 'error', error: msg });
      return { exitCode: 1, reason: `error: ${msg}` };
    }
  }

  stop(): void {
    this.stopRequested = true;
  }

  private async emitEvent(
    type: EngineEventType,
    ctx: FeatureLoopContext,
    data: Record<string, unknown>,
  ): Promise<void> {
    this.notifier.emitEngineEvent({
      type,
      timestamp: now(),
      data: {
        ...data,
        iteration: this.iteration,
        features_done: this.featuresDone,
        project: ctx.project,
      },
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

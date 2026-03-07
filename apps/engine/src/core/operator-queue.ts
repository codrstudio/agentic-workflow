import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { StateManager, now } from './state-manager.js';
import { AgentSpawner, type SpawnMeta } from './agent-spawner.js';
import { Notifier } from './notifier.js';
import { TemplateRenderer } from './template-renderer.js';
import { OperatorMessageSchema, type OperatorMessage } from '../schemas/operator-queue.js';
import type { EngineEventType } from '../schemas/event.js';

export interface OperatorQueueDrainConfig {
  worktreeDir: string;
  sprintDir: string;
  waveDir: string;
  agentsDir: string;
  tasksDir: string;
  waveNumber: number;
  sprintNumber: number;
  templateContext: Record<string, string>;
  project?: string;
}

export class OperatorQueue {
  private drainCount = 0;

  constructor(
    private readonly state: StateManager,
    private readonly spawner: AgentSpawner,
    private readonly notifier: Notifier,
    private readonly renderer: TemplateRenderer,
  ) {}

  /**
   * Enqueue a message from the operator into the JSONL queue file.
   */
  async enqueue(queuePath: string, message: string, source?: string): Promise<void> {
    const msg: OperatorMessage = {
      id: randomUUID(),
      timestamp: now(),
      message,
      source,
    };
    await this.state.appendLine(queuePath, JSON.stringify(msg));
    this.emitEvent('queue:received', {
      id: msg.id,
      message: msg.message.slice(0, 120),
      source: msg.source,
    });
  }

  /**
   * Check whether the queue file has any pending messages.
   */
  async hasPending(queuePath: string): Promise<boolean> {
    const text = await this.state.readText(queuePath);
    return text.trim().length > 0;
  }

  /**
   * Drain all pending messages in a loop: consume → spawn agent → re-check.
   * Returns when the queue is empty after a drain cycle.
   */
  async drainAll(queuePath: string, config: OperatorQueueDrainConfig): Promise<void> {
    while (await this.hasPending(queuePath)) {
      const messages = await this.consumeMessages(queuePath);
      if (messages.length === 0) break;

      this.emitEvent('queue:processing', {
        count: messages.length,
        project: config.project,
      });

      this.drainCount++;
      const outputDir = join(config.waveDir, 'operator-queue', `drain-${this.drainCount}`);
      await mkdir(outputDir, { recursive: true });

      const prompt = await this.composePrompt(messages, config);

      const task = await this.spawner.resolveTask('operator-message', config.tasksDir);
      const agentName = task.frontmatter.agent;
      const { frontmatter } = await this.spawner.resolveAgentProfile(agentName, config.agentsDir);

      const meta: SpawnMeta = {
        task: 'operator-message',
        agent: agentName,
        wave: config.waveNumber,
        step: 0,
        parent_pid: process.pid,
        pid: 0,
        started_at: now(),
        timed_out: false,
      };

      await this.spawner.writeSpawnMeta(outputDir, meta);

      const result = await this.spawner.spawnAgent({
        prompt,
        cwd: config.worktreeDir,
        outputDir,
        agentConfig: {
          allowedTools: frontmatter.allowedTools as string | undefined,
          max_turns: frontmatter.max_turns as number | undefined,
          model: frontmatter.model as string | undefined,
        },
        timeoutMs: frontmatter.timeout_minutes ? Number(frontmatter.timeout_minutes) * 60_000 : undefined,
        onSpawn: (pid) => {
          meta.pid = pid;
          this.spawner.writeSpawnMeta(outputDir, meta);
        },
      });

      meta.pid = result.pid;
      meta.finished_at = now();
      meta.exit_code = result.code;
      meta.timed_out = result.timedOut;
      await this.spawner.writeSpawnMeta(outputDir, meta);

      this.emitEvent('queue:done', {
        exit_code: result.code,
        timed_out: result.timedOut,
        drain: this.drainCount,
        project: config.project,
      });
    }
  }

  /**
   * Read all messages from the queue file, then truncate it.
   */
  private async consumeMessages(queuePath: string): Promise<OperatorMessage[]> {
    const text = await this.state.readText(queuePath);

    // Truncate the file
    await writeFile(queuePath, '', 'utf-8');

    const messages: OperatorMessage[] = [];
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const parsed = JSON.parse(trimmed);
        const result = OperatorMessageSchema.safeParse(parsed);
        if (result.success) {
          messages.push(result.data);
        }
      } catch {
        // Skip malformed lines
      }
    }
    return messages;
  }

  /**
   * Compose the full prompt for the operator-message agent.
   */
  private async composePrompt(messages: OperatorMessage[], config: OperatorQueueDrainConfig): Promise<string> {
    const task = await this.spawner.resolveTask('operator-message', config.tasksDir);
    const agentName = task.frontmatter.agent;
    const { body: agentBody } = await this.spawner.resolveAgentProfile(agentName, config.agentsDir);

    const formattedMessages = messages
      .map((m) => `### [${m.timestamp}] ${m.source ?? 'unknown'}\n\n${m.message}`)
      .join('\n\n---\n\n');

    const templateContext: Record<string, string> = {
      ...config.templateContext,
      operator_messages: formattedMessages,
    };

    const agentPrompt = this.renderer.render(agentBody, templateContext);
    const taskPrompt = this.renderer.render(task.body, templateContext);
    return `${agentPrompt}\n\n---\n\n# Task: operator-message\n\n${taskPrompt}`;
  }

  private emitEvent(type: EngineEventType, data: Record<string, unknown>): void {
    this.notifier.emitEngineEvent({
      type,
      timestamp: now(),
      data,
    });
  }
}

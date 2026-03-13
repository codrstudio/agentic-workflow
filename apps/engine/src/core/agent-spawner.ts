import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { TemplateRenderer } from './template-renderer.js';
import { now } from './state-manager.js';
import type { TaskFrontmatter } from '../schemas/task.js';

export interface ResolvedTask {
  frontmatter: TaskFrontmatter;
  body: string;
}

export interface SpawnAgentParams {
  prompt: string;
  cwd: string;
  outputDir: string;
  agentConfig: {
    allowedTools?: string;
    max_turns?: number | string;
    model?: string;
    effort?: string;
  };
  timeoutMs?: number;
  jsonSchema?: Record<string, unknown>;
  onSpawn?: (pid: number) => void;
  onChunkWritten?: () => void;
}

export interface SpawnAgentResult {
  code: number;
  pid: number;
  timedOut: boolean;
  response?: unknown;
  model_used: string;
}

export interface SpawnMeta {
  task: string;
  agent: string;
  wave: number;
  step: number;
  feature?: string;
  attempt?: number;
  parent_pid: number;
  pid: number;
  started_at: string;
  finished_at?: string;
  exit_code?: number;
  timed_out: boolean;
  model_used?: string;
}

export class AgentSpawner {
  private renderer = new TemplateRenderer();

  async resolveTask(taskSlug: string, tasksDir: string): Promise<ResolvedTask> {
    const taskPath = join(tasksDir, `${taskSlug}.md`);
    const content = await readFile(taskPath, 'utf-8');
    const { frontmatter, body } = this.renderer.parseFrontmatter(content);
    return {
      frontmatter: {
        agent: (frontmatter.agent as 'coder' | 'researcher' | 'general') ?? 'coder',
        description: (frontmatter.description as string) ?? '',
        model: frontmatter.model as TaskFrontmatter['model'],
        effort: frontmatter.effort as TaskFrontmatter['effort'],
        tier: frontmatter.tier as TaskFrontmatter['tier'],
      },
      body,
    };
  }

  async resolveAgentProfile(
    agentName: string,
    agentsDir: string,
  ): Promise<{ frontmatter: Record<string, unknown>; body: string }> {
    const agentPath = join(agentsDir, `${agentName}.md`);
    try {
      await access(agentPath);
    } catch {
      const fallback = join(agentsDir, 'coder.md');
      try {
        await access(fallback);
        const content = await readFile(fallback, 'utf-8');
        return this.renderer.parseFrontmatter(content);
      } catch {
        throw new Error(`Agent profile not found: ${agentPath}`);
      }
    }
    const content = await readFile(agentPath, 'utf-8');
    return this.renderer.parseFrontmatter(content);
  }

  async spawnAgent(params: SpawnAgentParams): Promise<SpawnAgentResult> {
    const { prompt, cwd, outputDir, agentConfig, timeoutMs } = params;

    await mkdir(outputDir, { recursive: true });

    const useJsonSchema = !!params.jsonSchema;
    const args: string[] = ['-p', '-', '--verbose', '--output-format', 'stream-json'];

    if (useJsonSchema) {
      args.push('--json-schema', JSON.stringify(params.jsonSchema));
    }

    const allowedTools = agentConfig.allowedTools ?? 'Edit,Write,Bash,Read,Glob,Grep';
    for (const tool of allowedTools.split(',')) {
      args.push('--allowedTools', tool.trim());
    }

    const maxTurns = process.env.MAX_TURNS ?? agentConfig.max_turns;
    if (maxTurns && Number(maxTurns) > 0) {
      args.push('--max-turns', String(maxTurns));
    }

    const model_used = agentConfig.model ?? process.env.MODEL ?? 'sonnet';
    args.push('--model', model_used);

    const effort = agentConfig.effort ?? process.env.EFFORT;
    if (effort) {
      args.push('--effort', effort);
    }

    const logPath = join(outputDir, 'spawn.jsonl');
    const logStream = createWriteStream(logPath, { flags: 'a' });

    return new Promise<SpawnAgentResult>((resolve) => {
      const proc: ChildProcess = spawn('claude', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      const pid = proc.pid ?? 0;
      if (pid > 0 && params.onSpawn) params.onSpawn(pid);
      const stdoutChunks: Buffer[] = [];

      proc.stdout?.on('data', (chunk: Buffer) => {
        logStream.write(chunk);
        params.onChunkWritten?.();
        if (useJsonSchema) stdoutChunks.push(chunk);
      });
      proc.stderr?.pipe(logStream);

      let inactivityTimer: ReturnType<typeof setTimeout> | null = null;
      let timedOut = false;

      const resetTimer = () => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        if (timeoutMs && timeoutMs > 0) {
          inactivityTimer = setTimeout(() => {
            timedOut = true;
            proc.kill('SIGTERM');
            setTimeout(() => {
              if (!proc.killed) proc.kill('SIGKILL');
            }, 10_000);
          }, timeoutMs);
        }
      };

      proc.stdout?.on('data', () => resetTimer());
      proc.stderr?.on('data', () => resetTimer());
      resetTimer();

      proc.stdin?.write(prompt);
      proc.stdin?.end();

      proc.on('exit', (code) => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        // Destroy streams so orphan child processes holding inherited
        // file descriptors don't keep the pipe open forever.
        proc.stdout?.destroy();
        proc.stderr?.destroy();
        logStream.end();

        let response: unknown;
        if (useJsonSchema && stdoutChunks.length > 0) {
          try {
            const raw = Buffer.concat(stdoutChunks).toString('utf-8').trim();
            const parsed = JSON.parse(raw);
            response = parsed.structured_output ?? (parsed.result || null);
          } catch {
            // JSON parse failed
          }
        }

        resolve({
          code: timedOut ? 124 : (code ?? 1),
          pid,
          timedOut,
          response,
          model_used,
        });
      });

      proc.on('error', (err) => {
        if (inactivityTimer) clearTimeout(inactivityTimer);
        logStream.end();
        console.error(`[agent-spawner] Process error: ${err.message}`);
        resolve({ code: 1, pid, timedOut: false, model_used });
      });
    });
  }

  /**
   * Write spawn metadata to the output directory.
   */
  async writeSpawnMeta(outputDir: string, meta: SpawnMeta): Promise<void> {
    const { writeFile } = await import('node:fs/promises');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(outputDir, 'spawn.json'), JSON.stringify(meta, null, 2));
  }
}

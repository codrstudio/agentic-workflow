import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";

export interface ClaudeStreamCallbacks {
  onDelta: (text: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: string) => void;
  onJsonlLine?: (line: string) => void;
}

export interface SpawnClaudeOptions {
  prompt: string;
  systemPrompt?: string;
  cwd?: string;
  model?: string;
  maxTurns?: number;
  allowedTools?: string[];
}

/**
 * Spawns a Claude Code CLI process and streams output via callbacks.
 * Uses `claude -p - --output-format stream-json` pattern (same as engine spawn-agent).
 * Returns the ChildProcess so callers can kill it for abort support.
 */
export function spawnClaudeStream(
  options: SpawnClaudeOptions,
  callbacks: ClaudeStreamCallbacks,
): ChildProcess {
  const args: string[] = ["-p", "-", "--verbose", "--output-format", "stream-json"];

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.maxTurns && options.maxTurns > 0) {
    args.push("--max-turns", String(options.maxTurns));
  }

  if (options.allowedTools && options.allowedTools.length > 0) {
    for (const tool of options.allowedTools) {
      args.push("--allowedTools", tool.trim());
    }
  }

  const proc = spawn("claude", args, {
    cwd: options.cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  let fullText = "";

  const rl = createInterface({ input: proc.stdout!, crlfDelay: Infinity });

  rl.on("line", (line) => {
    if (!line.trim()) return;

    if (callbacks.onJsonlLine) {
      callbacks.onJsonlLine(line);
    }

    try {
      const event = JSON.parse(line);

      // Claude Code stream-json emits objects with a "type" field
      if (event.type === "assistant" && event.message?.content) {
        // Full message block — extract text from content blocks
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            const newText = block.text.slice(fullText.length);
            if (newText) {
              fullText += newText;
              callbacks.onDelta(newText);
            }
          }
        }
      } else if (event.type === "content_block_delta" && event.delta?.text) {
        // Incremental text delta
        fullText += event.delta.text;
        callbacks.onDelta(event.delta.text);
      } else if (event.type === "result" && event.result) {
        // Final result message — extract any remaining text
        const resultText = typeof event.result === "string" ? event.result : "";
        if (resultText && resultText.length > fullText.length) {
          const remaining = resultText.slice(fullText.length);
          fullText += remaining;
          callbacks.onDelta(remaining);
        }
      }
    } catch {
      // Non-JSON line, ignore
    }
  });

  proc.on("exit", (code) => {
    rl.close();
    if (code === 0 || fullText.length > 0) {
      callbacks.onComplete(fullText);
    } else {
      callbacks.onError(`Claude Code CLI exited with code ${code}`);
    }
  });

  proc.on("error", (err) => {
    rl.close();
    callbacks.onError(`Failed to spawn Claude Code CLI: ${err.message}`);
  });

  // Compose input: system prompt + user prompt via stdin
  let stdinContent = "";
  if (options.systemPrompt) {
    stdinContent += options.systemPrompt + "\n\n---\n\n";
  }
  stdinContent += options.prompt;

  proc.stdin?.write(stdinContent);
  proc.stdin?.end();

  return proc;
}

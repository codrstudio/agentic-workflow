import { Hono } from "hono";
import path from "node:path";
import { readFile, readdir, stat } from "node:fs/promises";
import { readJSON, listDirs } from "../lib/fs-utils.js";
import { config } from "../lib/config.js";

const harness = new Hono();

interface SpawnMeta {
  task: string;
  agent: string;
  wave: number;
  step: number;
  parent_pid?: number;
  pid?: number;
  started_at?: string;
  finished_at?: string;
  exit_code?: number | null;
  timed_out?: boolean;
}

interface LoopMeta {
  status: string;
  pid?: number;
  iteration: number;
  total: number;
  done: number;
  remaining: number;
  features_done: number;
  started_at?: string;
  updated_at?: string;
  max_iterations?: number | null;
  max_features?: number | null;
  exit_reason?: string;
}

interface StepInfo {
  number: number;
  name: string;
  type: string;
  task: string;
  agent: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  finished_at?: string;
  exit_code?: number | null;
  duration_ms?: number | null;
}

interface WaveInfo {
  number: number;
  steps: StepInfo[];
  status: "running" | "completed" | "failed" | "idle";
}

function workspaceDir(slug: string): string {
  return path.join(config.workspacesDir, slug);
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

function parseStepDir(
  dirName: string
): { number: number; name: string } | null {
  const match = dirName.match(/^step-(\d+)-(.+)$/);
  if (!match) return null;
  return { number: parseInt(match[1]!, 10), name: match[2]! };
}

function inferStepType(name: string): string {
  if (name === "ralph-wiggum-loop") return "ralph-wiggum-loop";
  if (name === "wave-limit") return "spawn-agent-call";
  if (name === "merge-worktree") return "spawn-agent";
  return "spawn-agent";
}

function computeStepStatus(
  spawn: SpawnMeta | null
): "pending" | "running" | "completed" | "failed" {
  if (!spawn) return "pending";
  if (spawn.finished_at != null) {
    return spawn.exit_code === 0 ? "completed" : "failed";
  }
  if (spawn.started_at) return "running";
  return "pending";
}

function computeDurationMs(spawn: SpawnMeta | null): number | null {
  if (!spawn?.started_at || !spawn?.finished_at) return null;
  return (
    new Date(spawn.finished_at).getTime() -
    new Date(spawn.started_at).getTime()
  );
}

function computeWaveStatus(
  steps: StepInfo[]
): "running" | "completed" | "failed" | "idle" {
  if (steps.length === 0) return "idle";
  if (steps.some((s) => s.status === "running")) return "running";
  if (steps.some((s) => s.status === "failed")) return "failed";
  if (steps.every((s) => s.status === "completed")) return "completed";
  return "idle";
}

async function loadSpawn(stepPath: string): Promise<SpawnMeta | null> {
  try {
    return await readJSON<SpawnMeta>(path.join(stepPath, "spawn.json"));
  } catch {
    return null;
  }
}

async function loadLoop(stepPath: string): Promise<LoopMeta | null> {
  try {
    return await readJSON<LoopMeta>(path.join(stepPath, "loop.json"));
  } catch {
    return null;
  }
}

async function buildWaveInfo(
  wsDir: string,
  waveNumber: number
): Promise<WaveInfo> {
  const waveDir = path.join(wsDir, `wave-${waveNumber}`);
  const dirs = await listDirs(waveDir);

  const stepDirs = dirs
    .map((d) => ({ dir: d, parsed: parseStepDir(d) }))
    .filter((x): x is { dir: string; parsed: NonNullable<typeof x.parsed> } =>
      x.parsed !== null
    )
    .sort((a, b) => a.parsed.number - b.parsed.number);

  const steps: StepInfo[] = [];
  for (const { dir, parsed } of stepDirs) {
    const stepPath = path.join(waveDir, dir);
    const spawn = await loadSpawn(stepPath);

    steps.push({
      number: parsed.number,
      name: parsed.name,
      type: inferStepType(parsed.name),
      task: spawn?.task ?? parsed.name,
      agent: spawn?.agent ?? "unknown",
      status: computeStepStatus(spawn),
      started_at: spawn?.started_at,
      finished_at: spawn?.finished_at,
      exit_code: spawn?.exit_code ?? null,
      duration_ms: computeDurationMs(spawn),
    });
  }

  return {
    number: waveNumber,
    steps,
    status: computeWaveStatus(steps),
  };
}

// GET /hub/projects/:slug/harness/status — workspace status with waves and steps
harness.get("/hub/projects/:slug/harness/status", async (c) => {
  const slug = c.req.param("slug");
  const wsDir = workspaceDir(slug);

  if (!(await dirExists(wsDir))) {
    return c.json({ error: "Workspace not found" }, 404);
  }

  const allDirs = await listDirs(wsDir);
  const waveNumbers = allDirs
    .map((d) => {
      const m = d.match(/^wave-(\d+)$/);
      return m ? parseInt(m[1]!, 10) : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);

  const waves: WaveInfo[] = [];
  for (const waveNum of waveNumbers) {
    waves.push(await buildWaveInfo(wsDir, waveNum));
  }

  const currentWave = waves.length > 0 ? waves[waves.length - 1]! : null;

  return c.json({
    project: slug,
    waves,
    current_wave: currentWave?.number ?? null,
    status: currentWave?.status ?? "idle",
  });
});

// GET /hub/projects/:slug/harness/waves/:waveNumber/steps/:stepNumber — step detail
harness.get(
  "/hub/projects/:slug/harness/waves/:waveNumber/steps/:stepNumber",
  async (c) => {
    const slug = c.req.param("slug");
    const waveNumber = parseInt(c.req.param("waveNumber"), 10);
    const stepNumber = parseInt(c.req.param("stepNumber"), 10);

    if (isNaN(waveNumber) || waveNumber < 1) {
      return c.json({ error: "Invalid wave number" }, 400);
    }
    if (isNaN(stepNumber) || stepNumber < 1) {
      return c.json({ error: "Invalid step number" }, 400);
    }

    const wsDir = workspaceDir(slug);
    const waveDir = path.join(wsDir, `wave-${waveNumber}`);

    if (!(await dirExists(waveDir))) {
      return c.json({ error: "Wave not found" }, 404);
    }

    // Find the step dir matching the step number
    const dirs = await listDirs(waveDir);
    const stepEntry = dirs
      .map((d) => ({ dir: d, parsed: parseStepDir(d) }))
      .find((x) => x.parsed?.number === stepNumber);

    if (!stepEntry?.parsed) {
      return c.json({ error: "Step not found" }, 404);
    }

    const stepPath = path.join(waveDir, stepEntry.dir);
    const spawn = await loadSpawn(stepPath);
    const loop = await loadLoop(stepPath);

    return c.json({
      wave: waveNumber,
      step: stepNumber,
      name: stepEntry.parsed.name,
      type: inferStepType(stepEntry.parsed.name),
      task: spawn?.task ?? stepEntry.parsed.name,
      agent: spawn?.agent ?? "unknown",
      status: computeStepStatus(spawn),
      started_at: spawn?.started_at ?? null,
      finished_at: spawn?.finished_at ?? null,
      exit_code: spawn?.exit_code ?? null,
      pid: spawn?.pid ?? null,
      timed_out: spawn?.timed_out ?? false,
      duration_ms: computeDurationMs(spawn),
      loop: loop ?? null,
    });
  }
);

// GET /hub/projects/:slug/harness/waves/:waveNumber/steps/:stepNumber/log — tail spawn.jsonl
harness.get(
  "/hub/projects/:slug/harness/waves/:waveNumber/steps/:stepNumber/log",
  async (c) => {
    const slug = c.req.param("slug");
    const waveNumber = parseInt(c.req.param("waveNumber"), 10);
    const stepNumber = parseInt(c.req.param("stepNumber"), 10);
    const tail = Math.min(
      Math.max(parseInt(c.req.query("tail") ?? "100", 10) || 100, 1),
      1000
    );

    if (isNaN(waveNumber) || waveNumber < 1) {
      return c.json({ error: "Invalid wave number" }, 400);
    }
    if (isNaN(stepNumber) || stepNumber < 1) {
      return c.json({ error: "Invalid step number" }, 400);
    }

    const wsDir = workspaceDir(slug);
    const waveDir = path.join(wsDir, `wave-${waveNumber}`);

    if (!(await dirExists(waveDir))) {
      return c.json({ error: "Wave not found" }, 404);
    }

    // Find the step dir
    const dirs = await listDirs(waveDir);
    const stepEntry = dirs
      .map((d) => ({ dir: d, parsed: parseStepDir(d) }))
      .find((x) => x.parsed?.number === stepNumber);

    if (!stepEntry?.parsed) {
      return c.json({ error: "Step not found" }, 404);
    }

    const stepPath = path.join(waveDir, stepEntry.dir);

    // Try spawn.jsonl in the step dir, or in attempt subdirs for loop steps
    let logPath = path.join(stepPath, "spawn.jsonl");
    let content: string;

    try {
      content = await readFile(logPath, "utf-8");
    } catch {
      // For ralph-wiggum-loop steps, find the latest attempt subdir with a spawn.jsonl
      const subDirs = await listDirs(stepPath);
      const attemptDirs = subDirs
        .filter((d) => d.match(/^F-\d+-attempt-\d+$/))
        .sort();

      if (attemptDirs.length === 0) {
        return c.json({ error: "Log not found" }, 404);
      }

      // Get the latest attempt's log
      const latestAttempt = attemptDirs[attemptDirs.length - 1]!;
      logPath = path.join(stepPath, latestAttempt, "spawn.jsonl");

      try {
        content = await readFile(logPath, "utf-8");
      } catch {
        return c.json({ error: "Log not found" }, 404);
      }
    }

    const allLines = content.split("\n").filter((line) => line.trim() !== "");
    const lines = allLines.slice(-tail);

    return c.json({
      wave: waveNumber,
      step: stepNumber,
      total_lines: allLines.length,
      returned_lines: lines.length,
      lines,
    });
  }
);

export { harness };

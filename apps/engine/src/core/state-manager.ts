import { readFile, writeFile, access, appendFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, basename } from 'node:path';

/** ISO timestamp without milliseconds */
export function now(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export class StateManager {
  /**
   * Read and parse a JSON file.
   * Returns null if the file doesn't exist or can't be parsed.
   */
  async readJson<T = unknown>(path: string): Promise<T | null> {
    try {
      const raw = await readFile(path, 'utf-8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  /**
   * Write data as JSON atomically (write + rename pattern).
   * Creates parent directories if needed.
   */
  async writeJson(path: string, data: unknown): Promise<void> {
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    const tmp = path + '.tmp';
    await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    // Rename for atomic write
    const { rename } = await import('node:fs/promises');
    await rename(tmp, path);
  }

  /**
   * Check if a file exists.
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Append a line to a text file (e.g., progress.txt).
   */
  async appendLine(path: string, line: string): Promise<void> {
    const dir = dirname(path);
    await mkdir(dir, { recursive: true });
    await appendFile(path, line + '\n', 'utf-8');
  }

  /**
   * Read a text file, return empty string if not found.
   */
  async readText(path: string): Promise<string> {
    try {
      return await readFile(path, 'utf-8');
    } catch {
      return '';
    }
  }

  /**
   * Load features from JSON file. Handles both array and {features:[]} formats.
   */
  async loadFeatures(path: string): Promise<unknown[]> {
    const data = await this.readJson(path);
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (typeof data === 'object' && data !== null && 'features' in data) {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.features)) return obj.features;
    }
    return [];
  }

  /**
   * Save features array to JSON file.
   */
  async saveFeatures(path: string, features: unknown[]): Promise<void> {
    await this.writeJson(path, features);
  }

  /**
   * Resolve the next attempt directory for a step.
   * - If no attempt-N dirs exist → return attempt-1
   * - If last attempt-N has no spawn.json → reuse it (attempt never started)
   * - If last attempt-N has spawn.json → return attempt-(N+1)
   */
  async resolveNextAttemptDir(stepDir: string): Promise<string> {
    await mkdir(stepDir, { recursive: true });
    let entries: string[];
    try {
      entries = await readdir(stepDir);
    } catch {
      entries = [];
    }
    const attemptDirs = entries
      .filter((e) => /^attempt-\d+$/.test(e))
      .sort((a, b) => {
        const na = parseInt(basename(a).split('-')[1]!, 10);
        const nb = parseInt(basename(b).split('-')[1]!, 10);
        return na - nb;
      });
    if (attemptDirs.length === 0) {
      return join(stepDir, 'attempt-1');
    }
    const lastDir = attemptDirs[attemptDirs.length - 1]!;
    const lastDirPath = join(stepDir, lastDir);
    const hasSpawnJson = await this.fileExists(join(lastDirPath, 'spawn.json'));
    if (hasSpawnJson) {
      const n = parseInt(basename(lastDir).split('-')[1]!, 10);
      return join(stepDir, `attempt-${n + 1}`);
    }
    return lastDirPath;
  }
}

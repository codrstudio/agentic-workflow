import { readFile, writeFile, mkdir, rename, readdir, stat } from "node:fs/promises";
import path from "node:path";

/**
 * Read and parse a JSON file. Throws with a clear message on failure.
 */
export async function readJSON<T = unknown>(filePath: string): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    if (e.code === "EACCES") {
      throw new Error(`Permission denied: ${filePath}`);
    }
    if (err instanceof SyntaxError) {
      throw new Error(`Invalid JSON in file: ${filePath}`);
    }
    throw new Error(`Failed to read JSON from ${filePath}: ${e.message}`);
  }
}

/**
 * Serialize and write JSON to a file with 2-space indentation.
 * Creates parent directories if needed.
 */
export async function writeJSON(filePath: string, data: unknown): Promise<void> {
  try {
    await ensureDir(path.dirname(filePath));
    const content = JSON.stringify(data, null, 2) + "\n";
    await writeFile(filePath, content, "utf-8");
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EACCES") {
      throw new Error(`Permission denied: ${filePath}`);
    }
    throw new Error(`Failed to write JSON to ${filePath}: ${e.message}`);
  }
}

/**
 * Create a directory recursively if it does not exist.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "EACCES") {
      throw new Error(`Permission denied: ${dirPath}`);
    }
    throw new Error(`Failed to create directory ${dirPath}: ${e.message}`);
  }
}

/**
 * Move a file or directory to a .trash/ folder with a timestamp suffix.
 * The .trash/ folder is created at the same level as the parent of the target.
 */
export async function moveToTrash(targetPath: string, trashRoot: string): Promise<string> {
  const basename = path.basename(targetPath);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const trashName = `${basename}-${timestamp}`;
  const trashPath = path.join(trashRoot, ".trash", trashName);

  try {
    await ensureDir(path.dirname(trashPath));
    await rename(targetPath, trashPath);
    return trashPath;
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      throw new Error(`Path not found: ${targetPath}`);
    }
    if (e.code === "EACCES") {
      throw new Error(`Permission denied moving ${targetPath} to trash`);
    }
    throw new Error(`Failed to move ${targetPath} to trash: ${e.message}`);
  }
}

/**
 * List subdirectory names in a given path.
 * Returns an empty array if the directory does not exist.
 */
export async function listDirs(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === "ENOENT") {
      return [];
    }
    if (e.code === "EACCES") {
      throw new Error(`Permission denied: ${dirPath}`);
    }
    throw new Error(`Failed to list directories in ${dirPath}: ${e.message}`);
  }
}

/**
 * Convert a name to a URL-safe slug (lowercase, hyphens, no accents).
 */
export function generateSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric except spaces and hyphens
    .trim()
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}

import { Hono } from 'hono';
import { execSync } from 'node:child_process';

interface EditorOption {
  id: string;
  label: string;
  cmd: string;
  wsl: boolean;
}

let cachedEditors: EditorOption[] | null = null;

function commandExists(cmd: string): boolean {
  try {
    execSync(`where ${cmd}`, { stdio: 'ignore', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function wslAvailable(): boolean {
  try {
    execSync('wsl --status', { stdio: 'ignore', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function detectEditors(): EditorOption[] {
  if (cachedEditors) return cachedEditors;

  const editors: EditorOption[] = [];
  const hasWsl = wslAvailable();

  if (commandExists('code')) {
    editors.push({ id: 'code', label: 'VS Code', cmd: 'code', wsl: false });
    if (hasWsl) {
      editors.push({ id: 'code-wsl', label: 'VS Code (WSL)', cmd: 'code', wsl: true });
    }
  }

  if (commandExists('codium')) {
    editors.push({ id: 'codium', label: 'VSCodium', cmd: 'codium', wsl: false });
    if (hasWsl) {
      editors.push({ id: 'codium-wsl', label: 'VSCodium (WSL)', cmd: 'codium', wsl: true });
    }
  }

  if (commandExists('antigravity')) {
    editors.push({ id: 'antigravity', label: 'Antigravity', cmd: 'antigravity', wsl: false });
    if (hasWsl) {
      editors.push({ id: 'antigravity-wsl', label: 'Antigravity (WSL)', cmd: 'antigravity', wsl: true });
    }
  }

  if (commandExists('cursor')) {
    editors.push({ id: 'cursor', label: 'Cursor', cmd: 'cursor', wsl: false });
    if (hasWsl) {
      editors.push({ id: 'cursor-wsl', label: 'Cursor (WSL)', cmd: 'cursor', wsl: true });
    }
  }

  editors.push({ id: 'explorer', label: 'Explorer', cmd: 'explorer.exe', wsl: false });

  cachedEditors = editors;
  return editors;
}

const app = new Hono();

// GET /api/v1/system/editors
app.get('/editors', (c) => {
  const editors = detectEditors();
  return c.json({ editors });
});

// POST /api/v1/system/editors/invalidate — force re-detection
app.post('/editors/invalidate', (c) => {
  cachedEditors = null;
  const editors = detectEditors();
  return c.json({ editors });
});

export { app as system, detectEditors };

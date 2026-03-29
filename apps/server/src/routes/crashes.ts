import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from '../lib/paths.js';

export interface CrashSummary {
  wave: number;
  file: string;
  timestamp: string;
  handler: string;
  pid: number;
  uptime: string;
  errorMessage: string;
  memory: { rss: string; heapUsed: string; heapTotal: string };
  hasWorkflowState: boolean;
  engineLogLines: number;
  task?: string;
  agent?: string;
  inactivity?: string;
}

export interface CrashDetail extends CrashSummary {
  nodeVersion: string;
  platform: string;
  argv: string;
  errorStack: string;
  workflowState: unknown;
  engineLogTail: string[];
}

function parseCrashReport(content: string): Omit<CrashDetail, 'wave' | 'file'> {
  const lines = content.split('\n');

  // Split into sections
  const sections = new Map<string, string>();
  let currentSection = 'header';
  let currentLines: string[] = [];

  for (const line of lines) {
    const sectionMatch = line.match(/^---\s+(.+?)\s+---$/);
    if (sectionMatch) {
      sections.set(currentSection, currentLines.join('\n'));
      currentSection = sectionMatch[1] ?? 'unknown';
      currentLines = [];
    } else if (line === '=== CRASH REPORT ===' || line === '') {
      // skip
    } else {
      currentLines.push(line);
    }
  }
  sections.set(currentSection, currentLines.join('\n'));

  // Parse header (key: value lines)
  const headerLines = (sections.get('header') ?? '').split('\n');
  const header: Record<string, string> = {};
  for (const line of headerLines) {
    const m = line.match(/^([^:]+):\s+(.+)$/);
    if (m && m[1] && m[2]) {
      header[m[1].trim().toLowerCase()] = m[2].trim();
    }
  }

  // Parse memory section
  const memLines = (sections.get('memory') ?? '').split('\n');
  const mem: Record<string, string> = {};
  for (const line of memLines) {
    const m = line.match(/^([^:]+):\s+(.+)$/);
    if (m && m[1] && m[2]) {
      mem[m[1].trim().toLowerCase()] = m[2].trim();
    }
  }

  // Parse error section — first line is message, rest is full stack
  const errorSection = sections.get('error') ?? '';
  const errorLines = errorSection.split('\n').filter(Boolean);
  const errorMessage = errorLines[0] ?? '';
  const errorStack = errorSection;

  // Parse workflow-state section
  const workflowStateSection = sections.get('workflow-state') ?? '';
  let workflowState: unknown = null;
  let hasWorkflowState = false;
  if (workflowStateSection.trim() && workflowStateSection.trim() !== 'N/A') {
    try {
      workflowState = JSON.parse(workflowStateSection.trim());
      hasWorkflowState = true;
    } catch {
      // not valid JSON
    }
  }

  // Parse engine.jsonl section — find by prefix
  let engineLogTail: string[] = [];
  for (const [key, value] of sections) {
    if (key.startsWith('engine.jsonl')) {
      engineLogTail = value.split('\n').filter(Boolean);
      break;
    }
  }

  return {
    timestamp: header['timestamp'] ?? new Date(0).toISOString(),
    handler: header['handler'] ?? 'unknown',
    pid: parseInt(header['pid'] ?? '0', 10),
    uptime: header['uptime'] ?? '0s',
    nodeVersion: header['node'] ?? '',
    platform: header['platform'] ?? '',
    argv: header['argv'] ?? '',
    errorMessage,
    errorStack,
    memory: {
      rss: mem['rss'] ?? '0 MB',
      heapUsed: mem['heap used'] ?? '0 MB',
      heapTotal: mem['heap total'] ?? '0 MB',
    },
    hasWorkflowState,
    workflowState,
    engineLogLines: engineLogTail.length,
    engineLogTail,
    task: header['task'],
    agent: header['agent'],
    inactivity: header['inactivity'],
  };
}

async function getReportsForWave(workspaceDir: string, wave: number): Promise<CrashDetail[]> {
  const waveDir = path.join(workspaceDir, `wave-${wave}`);
  const results: CrashDetail[] = [];

  // Check crash-report.log
  try {
    const content = await fs.readFile(path.join(waveDir, 'crash-report.log'), 'utf-8');
    const parsed = parseCrashReport(content);
    results.push({ wave, file: 'crash-report.log', ...parsed });
  } catch {
    // no crash report
  }

  // Scan for stagnation-report-*.log
  try {
    const entries = await fs.readdir(waveDir);
    for (const entry of entries) {
      if (entry.startsWith('stagnation-report-') && entry.endsWith('.log')) {
        try {
          const content = await fs.readFile(path.join(waveDir, entry), 'utf-8');
          const parsed = parseCrashReport(content);
          results.push({ wave, file: entry, ...parsed });
        } catch {
          // skip unreadable
        }
      }
    }
  } catch {
    // wave dir unreadable
  }

  return results;
}

const app = new Hono();

// GET /api/v1/projects/:slug/crashes
app.get('/', async (c) => {
  const slug = c.req.param('slug') ?? '';
  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);

  let entries: string[];
  try {
    entries = await fs.readdir(workspaceDir);
  } catch {
    return c.json([]);
  }

  const waveNums = entries
    .map((e) => e.match(/^wave-(\d+)$/))
    .filter(Boolean)
    .map((m) => parseInt(m![1]!, 10))
    .sort((a, b) => a - b);

  const crashes: CrashSummary[] = [];

  for (const wave of waveNums) {
    const reports = await getReportsForWave(workspaceDir, wave);
    for (const detail of reports) {
      const { errorStack: _s, workflowState: _w, engineLogTail: _e, nodeVersion: _n, platform: _p, argv: _a, ...summary } = detail;
      crashes.push(summary);
    }
  }

  // Sort by timestamp descending
  crashes.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return c.json(crashes);
});

// GET /api/v1/projects/:slug/crashes/:wave?file=filename
app.get('/:wave', async (c) => {
  const slug = c.req.param('slug') ?? '';
  const wave = parseInt(c.req.param('wave') ?? '', 10);
  if (isNaN(wave)) return c.json({ error: 'Invalid wave number' }, 400);

  const file = c.req.query('file') ?? 'crash-report.log';

  // Sanitize filename to prevent path traversal
  const safeFile = path.basename(file);
  if (!safeFile.endsWith('.log')) return c.json({ error: 'Invalid file' }, 400);

  const awRoot = getAwRoot();
  const workspaceDir = path.join(awRoot, 'context', 'workspaces', slug);
  const filePath = path.join(workspaceDir, `wave-${wave}`, safeFile);

  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch {
    return c.json({ error: 'Report not found' }, 404);
  }

  const parsed = parseCrashReport(content);
  return c.json({ wave, file: safeFile, ...parsed });
});

export { app as crashes };

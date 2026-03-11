import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { runs } from './runs.js';
import { waves } from './waves.js';
import { messages } from './messages.js';
import { monitor } from './monitor.js';
import { getAwRoot } from '../lib/paths.js';

const app = new Hono();

async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as unknown;
}

type ArtifactEntry = { path: string; type: 'file' | 'dir'; size?: number };

async function walkArtifacts(dir: string, base: string): Promise<ArtifactEntry[]> {
  const result: ArtifactEntry[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const relPath = base ? `${base}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      result.push({ path: relPath, type: 'dir' });
      const children = await walkArtifacts(path.join(dir, entry.name), relPath);
      result.push(...children);
    } else {
      const stat = await fs.stat(path.join(dir, entry.name));
      result.push({ path: relPath, type: 'file', size: stat.size });
    }
  }
  return result;
}

// GET /api/v1/projects
app.get('/', async (c) => {
  const awRoot = getAwRoot();
  const projectsDir = path.join(awRoot, 'context', 'projects');

  let entries: string[];
  try {
    entries = await fs.readdir(projectsDir);
  } catch {
    return c.json({ total: 0, offset: 0, limit: 12, projects: [] });
  }

  const allProjects: Array<{ name: string; slug: string; description?: string; status?: string }> = [];

  for (const entry of entries) {
    const projectFile = path.join(projectsDir, entry, 'project.json');
    try {
      const data = await readJson(projectFile) as Record<string, unknown>;
      allProjects.push({
        name: data['name'] as string,
        slug: data['slug'] as string,
        description: data['description'] as string | undefined,
        status: data['status'] as string | undefined,
      });
    } catch {
      // skip entries without project.json
    }
  }

  allProjects.sort((a, b) => a.name.localeCompare(b.name));

  const rawOffset = parseInt(c.req.query('offset') ?? '0', 10);
  const rawLimit = parseInt(c.req.query('limit') ?? '12', 10);
  const offset = isNaN(rawOffset) || rawOffset < 0 ? 0 : rawOffset;
  const limit = isNaN(rawLimit) || rawLimit < 1 ? 12 : Math.min(rawLimit, 100);

  const projects = allProjects.slice(offset, offset + limit);

  return c.json({ total: allProjects.length, offset, limit, projects });
});

// GET /api/v1/projects/:slug
app.get('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const awRoot = getAwRoot();
  const projectFile = path.join(awRoot, 'context', 'projects', slug, 'project.json');

  let projectData: Record<string, unknown>;
  try {
    projectData = await readJson(projectFile) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Project not found' }, 404);
  }

  // Try to read workspace info
  const workspaceFile = path.join(awRoot, 'context', 'workspaces', slug, 'workspace.json');
  let workspaceData: Record<string, unknown> | null = null;
  try {
    workspaceData = await readJson(workspaceFile) as Record<string, unknown>;
  } catch {
    // workspace may not exist yet
  }

  return c.json({
    ...projectData,
    workspace: workspaceData,
  });
});

// POST /api/v1/projects
app.post('/', async (c) => {
  const body = await c.req.json() as {
    name?: string;
    slug?: string;
    description?: string;
  };

  if (!body.name || !body.slug) {
    return c.json({ error: 'name and slug are required' }, 400);
  }

  const awRoot = getAwRoot();
  const projectDir = path.join(awRoot, 'context', 'projects', body.slug);

  try {
    await fs.access(projectDir);
    return c.json({ error: 'Slug already exists' }, 400);
  } catch {
    // directory doesn't exist, proceed
  }

  await fs.mkdir(projectDir, { recursive: true });

  const projectJson: Record<string, unknown> = {
    name: body.name,
    slug: body.slug,
    created_at: new Date().toISOString(),
    status: 'brainstorming',
  };
  if (body.description) projectJson['description'] = body.description;

  await fs.writeFile(path.join(projectDir, 'project.json'), JSON.stringify(projectJson, null, 2));
  await fs.writeFile(path.join(projectDir, 'TASK.md'), '');

  return c.json({ slug: body.slug }, 201);
});

// PATCH /api/v1/projects/:slug
app.patch('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const awRoot = getAwRoot();
  const projectFile = path.join(awRoot, 'context', 'projects', slug, 'project.json');

  let data: Record<string, unknown>;
  try {
    data = await readJson(projectFile) as Record<string, unknown>;
  } catch {
    return c.json({ error: 'Project not found' }, 404);
  }

  const body = await c.req.json() as {
    name?: string;
    description?: string;
    source_folder?: string;
    target_folder?: string;
    params?: Record<string, string>;
    repo?: { url: string; source_branch: string; target_branch?: string } | null;
  };

  if ('name' in body) data['name'] = body.name;
  if ('description' in body) data['description'] = body.description;
  if ('source_folder' in body) data['source_folder'] = body.source_folder;
  if ('target_folder' in body) data['target_folder'] = body.target_folder;
  if ('params' in body) data['params'] = body.params;
  if ('repo' in body) data['repo'] = body.repo;

  await fs.writeFile(projectFile, JSON.stringify(data, null, 2));
  return c.json(data);
});

// GET /api/v1/projects/:slug/task
app.get('/:slug/task', async (c) => {
  const slug = c.req.param('slug');
  const awRoot = getAwRoot();
  const taskFile = path.join(awRoot, 'context', 'projects', slug, 'TASK.md');
  try {
    const content = await fs.readFile(taskFile, 'utf-8');
    return c.json({ content });
  } catch {
    return c.json({ content: '' });
  }
});

// PUT /api/v1/projects/:slug/task
app.put('/:slug/task', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json() as { content?: string };
  const awRoot = getAwRoot();
  const taskFile = path.join(awRoot, 'context', 'projects', slug, 'TASK.md');
  await fs.writeFile(taskFile, body.content ?? '');
  return c.json({ ok: true });
});

// POST /api/v1/projects/:slug/artifacts (upload)
app.post('/:slug/artifacts', async (c) => {
  const slug = c.req.param('slug');
  const awRoot = getAwRoot();
  const projectDir = path.join(awRoot, 'context', 'projects', slug);
  const form = await c.req.formData();
  const files = form.getAll('file');
  let uploaded = 0;
  for (const f of files) {
    const file = f as File;
    const dest = path.join(projectDir, 'artifacts', file.name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, Buffer.from(await file.arrayBuffer()));
    uploaded++;
  }
  return c.json({ uploaded });
});

// GET /api/v1/projects/:slug/artifacts (list)
app.get('/:slug/artifacts', async (c) => {
  const slug = c.req.param('slug');
  const awRoot = getAwRoot();
  const artifactsDir = path.join(awRoot, 'context', 'projects', slug, 'artifacts');

  try {
    await fs.access(artifactsDir);
  } catch {
    return c.json([]);
  }

  const result = await walkArtifacts(artifactsDir, '');
  return c.json(result);
});

// DELETE /api/v1/projects/:slug/artifacts
app.delete('/:slug/artifacts', async (c) => {
  const slug = c.req.param('slug');
  const awRoot = getAwRoot();
  const artifactsDir = path.resolve(awRoot, 'context', 'projects', slug, 'artifacts');
  const body = await c.req.json() as { paths?: string[] };
  const paths = body.paths ?? [];
  let deleted = 0;
  for (const p of paths) {
    const target = path.resolve(artifactsDir, p);
    if (!target.startsWith(artifactsDir)) continue;
    try {
      await fs.rm(target, { recursive: true, force: true });
      deleted++;
    } catch {
      // ignore
    }
  }
  return c.json({ deleted });
});

// GET /api/v1/projects/:slug/artifacts/* (file content)
app.get('/:slug/artifacts/*', async (c) => {
  const slug = c.req.param('slug');
  const filePath = c.req.param('*') ?? '';
  const awRoot = getAwRoot();
  const artifactsDir = path.resolve(awRoot, 'context', 'projects', slug, 'artifacts');
  const target = path.resolve(artifactsDir, filePath);

  if (!target.startsWith(artifactsDir)) {
    return c.json({ error: 'Invalid path' }, 400);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.txt') {
    return c.json({ error: 'Unsupported file type' }, 415);
  }

  try {
    const content = await fs.readFile(target, 'utf-8');
    return c.text(content);
  } catch {
    return c.json({ error: 'File not found' }, 404);
  }
});

// PUT /api/v1/projects/:slug/artifacts/* (update content)
app.put('/:slug/artifacts/*', async (c) => {
  const slug = c.req.param('slug');
  const filePath = c.req.param('*') ?? '';
  const awRoot = getAwRoot();
  const artifactsDir = path.resolve(awRoot, 'context', 'projects', slug, 'artifacts');
  const target = path.resolve(artifactsDir, filePath);

  if (!target.startsWith(artifactsDir)) {
    return c.json({ error: 'Invalid path' }, 400);
  }

  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.md' && ext !== '.txt') {
    return c.json({ error: 'Unsupported file type' }, 415);
  }

  const body = await c.req.json() as { content?: string };
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body.content ?? '');
  return c.json({ ok: true });
});

// POST /api/v1/projects/:slug/test-git
app.post('/:slug/test-git', async (c) => {
  const body = await c.req.json() as { url?: string };
  if (!body.url) return c.json({ ok: false, error: 'URL obrigatória' }, 400);

  const ok = await new Promise<boolean>(resolve => {
    const proc = spawn('git', ['ls-remote', '--exit-code', body.url!, 'HEAD']);
    const timer = setTimeout(() => { proc.kill(); resolve(false); }, 10_000);
    proc.on('close', code => { clearTimeout(timer); resolve(code === 0); });
    proc.on('error', () => { clearTimeout(timer); resolve(false); });
  });

  return c.json({ ok });
});

app.route('/:slug/runs', runs);
app.route('/:slug/waves', waves);
app.route('/:slug/messages', messages);
app.route('/:slug/monitor', monitor);

export { app as projects };

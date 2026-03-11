import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { runs } from './runs.js';
import { waves } from './waves.js';
import { messages } from './messages.js';
import { monitor } from './monitor.js';
import { getAllActions } from './agent-actions.js';
import { getAwRoot } from '../lib/paths.js';

const app = new Hono();

async function readJson(filePath: string): Promise<unknown> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as unknown;
}

// GET /api/v1/projects
app.get('/', async (c) => {
  const awRoot = getAwRoot();
  const projectsDir = path.join(awRoot, 'context', 'projects');

  let entries: string[];
  try {
    entries = await fs.readdir(projectsDir);
  } catch {
    return c.json([]);
  }

  const projects: Array<{ name: string; slug: string; description?: string; status?: string }> = [];

  for (const entry of entries) {
    const projectFile = path.join(projectsDir, entry, 'project.json');
    try {
      const data = await readJson(projectFile) as Record<string, unknown>;
      projects.push({
        name: data['name'] as string,
        slug: data['slug'] as string,
        description: data['description'] as string | undefined,
        status: data['status'] as string | undefined,
      });
    } catch {
      // skip entries without project.json
    }
  }

  return c.json(projects);
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
    repo?: { url: string; source_branch: string; target_branch?: string };
    task_content?: string;
  };

  if (!body.name || !body.slug) {
    return c.json({ error: 'name and slug are required' }, 400);
  }
  if (body.repo && !body.repo.source_branch) {
    return c.json({ error: 'repo.source_branch is required when repo is provided' }, 400);
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
  if (body.repo) projectJson['repo'] = body.repo;

  await fs.writeFile(path.join(projectDir, 'project.json'), JSON.stringify(projectJson, null, 2));
  await fs.writeFile(path.join(projectDir, 'TASK.md'), body.task_content ?? '');

  return c.json({ slug: body.slug }, 201);
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

// POST /api/v1/projects/:slug/artifacts
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
  // Update project.json with target_folder
  const projectFile = path.join(projectDir, 'project.json');
  try {
    const data = await readJson(projectFile) as Record<string, unknown>;
    data['target_folder'] = 'artifacts';
    await fs.writeFile(projectFile, JSON.stringify(data, null, 2));
  } catch {
    // ignore if project.json missing
  }
  return c.json({ uploaded });
});

app.route('/:slug/runs', runs);
app.route('/:slug/waves', waves);
app.route('/:slug/messages', messages);
app.route('/:slug/monitor', monitor);

// GET /api/v1/projects/:slug/agent-actions
app.get('/:slug/agent-actions', (c) => {
  const slug = c.req.param('slug');
  const actions = getAllActions(slug).slice().reverse();
  return c.json(actions);
});

export { app as projects };

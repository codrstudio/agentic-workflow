import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const app = new Hono();

function getAwRoot(): string {
  return process.env['AW_ROOT'] ?? process.cwd();
}

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

export { app as projects };

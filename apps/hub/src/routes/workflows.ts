import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const app = new Hono();

function getAwRoot(): string {
  return process.env['AW_ROOT'] ?? process.cwd();
}

// GET /api/v1/workflows
app.get('/', async (c) => {
  const awRoot = getAwRoot();
  const workflowsDir = path.join(awRoot, 'context', 'workflows');

  let entries: string[];
  try {
    entries = await fs.readdir(workflowsDir);
  } catch {
    return c.json([]);
  }

  const workflows: Array<{ slug: string; name: string; description?: string }> = [];

  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;

    const filePath = path.join(workflowsDir, entry);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = parseYaml(content) as Record<string, unknown>;
      const slug = entry.replace(/\.ya?ml$/, '');
      workflows.push({
        slug,
        name: (data['name'] as string | undefined) ?? slug,
        description: data['description'] as string | undefined,
      });
    } catch {
      // skip invalid yaml files
    }
  }

  return c.json(workflows);
});

export { app as workflows };

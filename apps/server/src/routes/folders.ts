import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getAwRoot } from '../lib/paths.js';

const app = new Hono();

interface Folder {
  id: string;
  name: string;
  icon?: string;
  order: number;
  projects: string[];
}

interface FoldersFile {
  folders: Folder[];
}

function foldersFilePath(): string {
  return path.join(getAwRoot(), 'context', 'folders.json');
}

async function readFolders(): Promise<FoldersFile> {
  try {
    const content = await fs.readFile(foldersFilePath(), 'utf-8');
    const parsed = JSON.parse(content) as FoldersFile;
    if (!parsed.folders) return { folders: [] };
    return parsed;
  } catch {
    return { folders: [] };
  }
}

async function writeFolders(data: FoldersFile): Promise<void> {
  const file = foldersFilePath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

function genId(): string {
  return `f_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// GET /api/v1/folders
app.get('/', async (c) => {
  const data = await readFolders();
  data.folders.sort((a, b) => a.order - b.order);
  return c.json(data);
});

// POST /api/v1/folders  { name, icon? }
app.post('/', async (c) => {
  const body = await c.req.json() as { name?: string; icon?: string };
  const name = (body.name ?? '').trim();
  if (!name) return c.json({ error: 'name required' }, 400);

  const data = await readFolders();
  const maxOrder = data.folders.reduce((m, f) => Math.max(m, f.order), 0);
  const folder: Folder = {
    id: genId(),
    name,
    icon: body.icon ?? 'folder',
    order: maxOrder + 1,
    projects: [],
  };
  data.folders.push(folder);
  await writeFolders(data);
  return c.json(folder, 201);
});

// PATCH /api/v1/folders/:id  { name?, icon?, order? }
app.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as { name?: string; icon?: string; order?: number };
  const data = await readFolders();
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return c.json({ error: 'not found' }, 404);
  if (typeof body.name === 'string') folder.name = body.name.trim();
  if (typeof body.icon === 'string') folder.icon = body.icon;
  if (typeof body.order === 'number') folder.order = body.order;
  await writeFolders(data);
  return c.json(folder);
});

// DELETE /api/v1/folders/:id
app.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const data = await readFolders();
  const next = data.folders.filter((f) => f.id !== id);
  if (next.length === data.folders.length) return c.json({ error: 'not found' }, 404);
  await writeFolders({ folders: next });
  return c.json({ ok: true });
});

// PUT /api/v1/folders/order  { order: [id1, id2, ...] }
app.put('/order', async (c) => {
  const body = await c.req.json() as { order?: string[] };
  const order = body.order ?? [];
  const data = await readFolders();
  const indexMap = new Map(order.map((id, i) => [id, i + 1]));
  for (const f of data.folders) {
    const idx = indexMap.get(f.id);
    if (typeof idx === 'number') f.order = idx;
  }
  await writeFolders(data);
  return c.json({ ok: true });
});

// POST /api/v1/folders/:id/projects  { slug }
app.post('/:id/projects', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json() as { slug?: string };
  const slug = (body.slug ?? '').trim();
  if (!slug) return c.json({ error: 'slug required' }, 400);

  const data = await readFolders();
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return c.json({ error: 'not found' }, 404);
  if (!folder.projects.includes(slug)) folder.projects.push(slug);
  await writeFolders(data);
  return c.json(folder);
});

// DELETE /api/v1/folders/:id/projects/:slug
app.delete('/:id/projects/:slug', async (c) => {
  const id = c.req.param('id');
  const slug = c.req.param('slug');
  const data = await readFolders();
  const folder = data.folders.find((f) => f.id === id);
  if (!folder) return c.json({ error: 'not found' }, 404);
  folder.projects = folder.projects.filter((s) => s !== slug);
  await writeFolders(data);
  return c.json(folder);
});

// DELETE /api/v1/folders/projects/:slug  — remove slug from ALL folders
app.delete('/projects/:slug', async (c) => {
  const slug = c.req.param('slug');
  const data = await readFolders();
  for (const f of data.folders) {
    f.projects = f.projects.filter((s) => s !== slug);
  }
  await writeFolders(data);
  return c.json({ ok: true });
});

export { app as folders };

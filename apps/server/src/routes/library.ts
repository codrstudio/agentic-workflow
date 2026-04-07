import { Hono } from 'hono';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getAwRoot } from '../lib/paths.js';

const app = new Hono();

// ── helpers ──────────────────────────────────────────────────────────

const CONTEXT_DIRS = ['agents', 'plans', 'tasks', 'workflows'] as const;
type ContextEntity = (typeof CONTEXT_DIRS)[number];

function contextDir(entity: ContextEntity): string {
  return path.join(getAwRoot(), 'context', entity);
}

/** Parse YAML frontmatter from markdown content */
function parseFrontmatter(raw: string): { meta: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };
  try {
    const meta = parseYaml(match[1]!) as Record<string, unknown>;
    return { meta: meta ?? {}, body: match[2]! };
  } catch {
    return { meta: {}, body: raw };
  }
}

/** Read all markdown files from a context directory */
async function readMdEntities(entity: ContextEntity) {
  const dir = contextDir(entity);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const results: Array<{ slug: string; meta: Record<string, unknown>; body: string }> = [];
  for (const entry of entries) {
    if (!entry.endsWith('.md')) continue;
    const filePath = path.join(dir, entry);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { meta, body } = parseFrontmatter(content);
      results.push({ slug: entry.replace(/\.md$/, ''), meta, body });
    } catch {
      // skip
    }
  }
  return results;
}

/** Read all YAML files from a context directory */
async function readYamlEntities(entity: ContextEntity) {
  const dir = contextDir(entity);
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }
  const results: Array<{ slug: string; data: Record<string, unknown>; raw: string }> = [];
  for (const entry of entries) {
    if (!entry.endsWith('.yaml') && !entry.endsWith('.yml')) continue;
    const filePath = path.join(dir, entry);
    try {
      const raw = await fs.readFile(filePath, 'utf-8');
      const data = parseYaml(raw) as Record<string, unknown>;
      results.push({ slug: entry.replace(/\.ya?ml$/, ''), data: data ?? {}, raw });
    } catch {
      // skip
    }
  }
  return results;
}

// ── cross-reference resolver ─────────────────────────────────────────

interface CrossRefs {
  /** task slug → agent slug */
  taskAgent: Map<string, string>;
  /** task slug → workflow slugs that reference it */
  taskUsedByWorkflows: Map<string, string[]>;
  /** agent slug → task slugs that use it */
  agentUsedByTasks: Map<string, string[]>;
  /** task slug → { plan slug → tier value } */
  taskTiers: Map<string, Array<{ plan: string; tier: string }>>;
}

async function buildCrossRefs(): Promise<CrossRefs> {
  const [tasks, workflows, plans] = await Promise.all([
    readMdEntities('tasks'),
    readYamlEntities('workflows'),
    readYamlEntities('plans'),
  ]);

  const taskAgent = new Map<string, string>();
  const taskUsedByWorkflows = new Map<string, string[]>();
  const agentUsedByTasks = new Map<string, string[]>();
  const taskTiers = new Map<string, Array<{ plan: string; tier: string }>>();

  // task → agent
  for (const t of tasks) {
    const agent = t.meta['agent'] as string | undefined;
    if (agent) {
      taskAgent.set(t.slug, agent);
      const arr = agentUsedByTasks.get(agent) ?? [];
      arr.push(t.slug);
      agentUsedByTasks.set(agent, arr);
    }
  }

  // workflow → tasks
  for (const w of workflows) {
    const steps = w.data['steps'] as Array<Record<string, unknown>> | undefined;
    if (!steps) continue;
    const slug = w.slug;
    for (const step of steps) {
      const task = step['task'] as string | undefined;
      if (task) {
        const arr = taskUsedByWorkflows.get(task) ?? [];
        if (!arr.includes(slug)) arr.push(slug);
        taskUsedByWorkflows.set(task, arr);
      }
      const workflow = step['workflow'] as string | undefined;
      if (workflow) {
        // spawn-workflow references — not a task ref
      }
    }
  }

  // plan → task tiers
  for (const p of plans) {
    const tiers = p.data['tiers'] as Record<string, string> | undefined;
    if (!tiers) continue;
    for (const [taskSlug, tierValue] of Object.entries(tiers)) {
      const arr = taskTiers.get(taskSlug) ?? [];
      arr.push({ plan: p.slug, tier: tierValue });
      taskTiers.set(taskSlug, arr);
    }
  }

  return { taskAgent, taskUsedByWorkflows, agentUsedByTasks, taskTiers };
}

// ── AGENTS ───────────────────────────────────────────────────────────

app.get('/agents', async (c) => {
  const [agents, refs] = await Promise.all([readMdEntities('agents'), buildCrossRefs()]);
  return c.json(
    agents.map((a) => ({
      slug: a.slug,
      ...a.meta,
      usedByTasks: refs.agentUsedByTasks.get(a.slug) ?? [],
    }))
  );
});

app.get('/agents/:slug', async (c) => {
  const slug = c.req.param('slug');
  const filePath = path.join(contextDir('agents'), `${slug}.md`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(content);
    const refs = await buildCrossRefs();
    return c.json({
      slug,
      ...meta,
      content: body,
      usedByTasks: refs.agentUsedByTasks.get(slug) ?? [],
    });
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
});

// ── TASKS ────────────────────────────────────────────────────────────

app.get('/tasks', async (c) => {
  const [tasks, refs] = await Promise.all([readMdEntities('tasks'), buildCrossRefs()]);
  return c.json(
    tasks.map((t) => ({
      slug: t.slug,
      ...t.meta,
      usedByWorkflows: refs.taskUsedByWorkflows.get(t.slug) ?? [],
      tiers: refs.taskTiers.get(t.slug) ?? [],
    }))
  );
});

app.get('/tasks/:slug', async (c) => {
  const slug = c.req.param('slug');
  const filePath = path.join(contextDir('tasks'), `${slug}.md`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const { meta, body } = parseFrontmatter(content);
    const refs = await buildCrossRefs();
    return c.json({
      slug,
      ...meta,
      content: body,
      usedByWorkflows: refs.taskUsedByWorkflows.get(slug) ?? [],
      tiers: refs.taskTiers.get(slug) ?? [],
    });
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
});

// ── WORKFLOWS ────────────────────────────────────────────────────────

app.get('/workflows', async (c) => {
  const [workflows, refs] = await Promise.all([readYamlEntities('workflows'), buildCrossRefs()]);
  return c.json(
    workflows.map((w) => {
      const steps = (w.data['steps'] as Array<Record<string, unknown>> | undefined) ?? [];
      const taskRefs = [
        ...new Set(steps.map((s) => s['task'] as string | undefined).filter(Boolean)),
      ] as string[];
      return {
        slug: w.slug,
        name: (w.data['name'] as string | undefined) ?? w.slug,
        description: w.data['description'] as string | undefined,
        sprint: w.data['sprint'] as boolean | undefined,
        stepCount: steps.length,
        taskRefs,
        steps: steps.map((s) => ({
          type: s['type'],
          task: s['task'] ?? undefined,
          workflow: s['workflow'] ?? undefined,
          stop_on: s['stop_on'] ?? undefined,
          agent: s['task'] ? refs.taskAgent.get(s['task'] as string) : undefined,
        })),
      };
    })
  );
});

app.get('/workflows/:slug', async (c) => {
  const slug = c.req.param('slug');
  const dir = contextDir('workflows');
  let filePath = path.join(dir, `${slug}.yaml`);
  try {
    await fs.access(filePath);
  } catch {
    filePath = path.join(dir, `${slug}.yml`);
  }
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = parseYaml(raw) as Record<string, unknown>;
    const refs = await buildCrossRefs();
    const steps = (data['steps'] as Array<Record<string, unknown>> | undefined) ?? [];
    const taskRefs = [
      ...new Set(steps.map((s) => s['task'] as string | undefined).filter(Boolean)),
    ] as string[];
    return c.json({
      slug,
      name: (data['name'] as string | undefined) ?? slug,
      description: data['description'] as string | undefined,
      sprint: data['sprint'] as boolean | undefined,
      stepCount: steps.length,
      taskRefs,
      raw,
      steps: steps.map((s) => ({
        type: s['type'],
        task: s['task'] ?? undefined,
        workflow: s['workflow'] ?? undefined,
        stop_on: s['stop_on'] ?? undefined,
        schema: s['schema'] ?? undefined,
        features_file: s['features_file'] ?? undefined,
        agent: s['task'] ? refs.taskAgent.get(s['task'] as string) : undefined,
      })),
    });
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
});

// ── PLANS ────────────────────────────────────────────────────────────

app.get('/plans', async (c) => {
  const plans = await readYamlEntities('plans');
  return c.json(
    plans.map((p) => {
      const tiers = (p.data['tiers'] as Record<string, string> | undefined) ?? {};
      return {
        slug: p.slug,
        name: (p.data['name'] as string | undefined) ?? p.slug,
        description: p.data['description'] as string | undefined,
        tierCount: Object.keys(tiers).length,
        taskRefs: Object.keys(tiers),
      };
    })
  );
});

app.get('/plans/:slug', async (c) => {
  const slug = c.req.param('slug');
  const dir = contextDir('plans');
  let filePath = path.join(dir, `${slug}.yaml`);
  try {
    await fs.access(filePath);
  } catch {
    filePath = path.join(dir, `${slug}.yml`);
  }
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    const data = parseYaml(raw) as Record<string, unknown>;
    return c.json({
      slug,
      name: (data['name'] as string | undefined) ?? slug,
      description: data['description'] as string | undefined,
      tiers: data['tiers'] ?? {},
      escalation: data['escalation'] ?? {},
      raw,
    });
  } catch {
    return c.json({ error: 'Not found' }, 404);
  }
});

// ── CHAT (placeholder — will be wired to Claude API) ─────────────────

app.post('/chat', async (c) => {
  const body = await c.req.json<{
    message: string;
    history?: Array<{ role: string; content: string }>;
    context?: { route?: string; entity?: string; slug?: string };
  }>();

  if (!body.message?.trim()) {
    return c.json({ error: 'Message is required' }, 400);
  }

  // For now, return a helpful placeholder response via SSE format
  const ctx = body.context;
  let contextInfo = '';
  if (ctx?.entity && ctx?.slug) {
    // Load the actual file content for context
    const entity = ctx.entity as ContextEntity;
    if (CONTEXT_DIRS.includes(entity)) {
      const ext = entity === 'workflows' || entity === 'plans' ? '.yaml' : '.md';
      const filePath = path.join(contextDir(entity), `${ctx.slug}${ext}`);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        contextInfo = `\n\nConteúdo atual de ${ctx.entity}/${ctx.slug}:\n\`\`\`\n${content}\n\`\`\``;
      } catch {
        contextInfo = `\n\n(${ctx.entity}/${ctx.slug} não encontrado)`;
      }
    }
  }

  const responseText =
    `O endpoint de chat ainda não está conectado à API do Claude. ` +
    `Quando estiver, vou poder ajudar a criar e editar workflows, tasks, agents e plans.\n\n` +
    `**Sua mensagem:** ${body.message}\n\n` +
    `**Contexto:** ${ctx?.entity ? `${ctx.entity}${ctx.slug ? '/' + ctx.slug : ''}` : 'nenhum'}` +
    contextInfo;

  // Return as SSE stream format
  c.header('Content-Type', 'text/event-stream');
  c.header('Cache-Control', 'no-cache');
  c.header('Connection', 'keep-alive');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send content in chunks to simulate streaming
      const chunk = JSON.stringify({ content: responseText });
      controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
});

export { app as library };

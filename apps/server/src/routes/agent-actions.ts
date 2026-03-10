import { Hono } from 'hono';
import { eventBus } from '../lib/event-bus.js';

export interface AgentAction {
  id: string;
  project_slug: string;
  action_type: string;
  status: 'running' | 'completed' | 'failed';
  agent_profile?: string;
  task_name?: string;
  feature_id?: string;
  spawn_dir?: string;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  exit_code?: number;
  output_preview?: string;
  requires_approval: boolean;
}

// In-memory store: slug -> list of actions
const actionsBySlug = new Map<string, AgentAction[]>();

let actionCounter = 0;

function getActions(slug: string): AgentAction[] {
  let list = actionsBySlug.get(slug);
  if (!list) {
    list = [];
    actionsBySlug.set(slug, list);
  }
  return list;
}

export function getAllActions(slug: string): AgentAction[] {
  return getActions(slug);
}

const app = new Hono();

// POST /api/v1/hub/projects/:slug/agent-actions
app.post('/:slug/agent-actions', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json<Record<string, unknown>>();

  const id = `aa-${Date.now()}-${++actionCounter}`;

  const action: AgentAction = {
    id,
    project_slug: slug,
    action_type: (body['action_type'] as string) ?? 'unknown',
    status: 'running',
    started_at: (body['started_at'] as string) ?? new Date().toISOString(),
    requires_approval: (body['requires_approval'] as boolean) ?? false,
  };

  if (body['agent_profile']) action.agent_profile = body['agent_profile'] as string;
  if (body['task_name']) action.task_name = body['task_name'] as string;
  if (body['feature_id']) action.feature_id = body['feature_id'] as string;
  if (body['spawn_dir']) action.spawn_dir = body['spawn_dir'] as string;

  getActions(slug).push(action);

  eventBus.broadcast({
    type: 'agent:action:start',
    data: action,
    timestamp: new Date().toISOString(),
  });

  return c.json({ id }, 201);
});

// PATCH /api/v1/hub/projects/:slug/agent-actions/:id
app.patch('/:slug/agent-actions/:id', async (c) => {
  const slug = c.req.param('slug');
  const actionId = c.req.param('id');
  const body = await c.req.json<Record<string, unknown>>();

  const actions = getActions(slug);
  const action = actions.find((a) => a.id === actionId);

  if (!action) {
    return c.json({ error: 'Action not found' }, 404);
  }

  if (body['status']) action.status = body['status'] as 'running' | 'completed' | 'failed';
  if (body['completed_at']) action.completed_at = body['completed_at'] as string;
  if (body['duration_ms'] !== undefined) action.duration_ms = body['duration_ms'] as number;
  if (body['exit_code'] !== undefined) action.exit_code = body['exit_code'] as number;
  if (body['output_preview']) action.output_preview = body['output_preview'] as string;

  eventBus.broadcast({
    type: 'agent:action:end',
    data: action,
    timestamp: new Date().toISOString(),
  });

  return c.json(action);
});

// GET /api/v1/hub/projects/:slug/agent-actions (used by F-027)
app.get('/:slug/agent-actions', (c) => {
  const slug = c.req.param('slug');
  const actions = getActions(slug).slice().reverse();
  return c.json(actions);
});

export { app as agentActions };

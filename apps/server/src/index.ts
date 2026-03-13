import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestLogger } from './middleware/logger.js';
import { serve } from '@hono/node-server';
import { health } from './routes/health.js';
import { auth } from './routes/auth.js';
import { projects } from './routes/projects.js';
import { workflows } from './routes/workflows.js';
import { events } from './routes/events.js';
import { engineEvents } from './routes/engine-events.js';
import { pid, activeRuns } from './routes/pid.js';
import { authMiddleware } from './middleware/auth.js';
import { resumeInterruptedWorkflows } from './lib/resume.js';
import { monitorService } from './lib/monitor-service.js';

const app = new Hono().basePath('/api/v1');

app.use('*', requestLogger);

app.use(
  '*',
  cors({
    origin: `http://localhost:${process.env['WEB_PORT']}`,
    credentials: true,
  })
);

app.use('*', authMiddleware);

app.route('/health', health);
app.route('/auth', auth);
app.route('/projects', projects);
app.route('/workflows', workflows);
app.route('/events', events);
app.route('/hub/engine-events', engineEvents);
app.route('/pid', pid);
app.route('/runs/active', activeRuns);

const PORT = parseInt(process.env['SERVER_PORT']!, 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Server listening on http://localhost:${info.port}`);
  monitorService.start();
  resumeInterruptedWorkflows().catch((err) => {
    console.error('[resume] Unexpected error during startup resume:', err);
  });
});

export { app };

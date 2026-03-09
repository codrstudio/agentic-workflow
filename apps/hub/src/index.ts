import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { health } from './routes/health.js';
import { auth } from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

app.use('*', logger());

app.use(
  '*',
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use('/api/v1/*', authMiddleware);

app.route('/api/v1/health', health);
app.route('/api/v1/auth', auth);

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`Hub listening on http://localhost:${info.port}`);
});

export { app };

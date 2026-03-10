import { Hono } from 'hono';

const health = new Hono();

const startTime = Date.now();

health.get('/', (c) => {
  return c.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
  });
});

export { health };

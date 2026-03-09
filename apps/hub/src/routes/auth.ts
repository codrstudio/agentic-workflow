import { Hono } from 'hono';
import { sign, verify } from 'hono/jwt';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'aw-monitor-secret-key-change-in-prod';

function getEnv() {
  return {
    username: process.env['SYSUSER'] ?? 'admin',
    password: process.env['SYSPASS'] ?? 'admin',
    role: process.env['SYSROLE'] ?? 'admin',
  };
}

const auth = new Hono();

auth.post('/login', async (c) => {
  const body = await c.req.json<{ username?: string; password?: string }>();
  const env = getEnv();

  if (body.username !== env.username || body.password !== env.password) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const payload = {
    username: env.username,
    role: env.role,
    exp: Math.floor(Date.now() / 1000) + 86400 * 30,
  };

  const token = await sign(payload, JWT_SECRET);

  setCookie(c, 'token', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'Lax',
    maxAge: 86400 * 30,
  });

  return c.json({ ok: true });
});

auth.get('/me', async (c) => {
  const token = getCookie(c, 'token');
  if (!token) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const payload = await verify(token, JWT_SECRET, 'HS256') as { username: string; role: string };
    return c.json({ username: payload.username, role: payload.role });
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
});

auth.post('/logout', (c) => {
  deleteCookie(c, 'token', { path: '/' });
  return c.json({ ok: true });
});

export { auth };

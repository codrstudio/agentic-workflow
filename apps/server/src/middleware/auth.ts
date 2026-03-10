import { verify } from 'hono/jwt';
import { getCookie } from 'hono/cookie';
import type { Context, Next } from 'hono';

const JWT_SECRET = process.env['JWT_SECRET'] ?? 'aw-monitor-secret-key-change-in-prod';

const UNPROTECTED_PATHS = new Set([
  '/api/v1/health',
  '/api/v1/auth/login',
  '/api/v1/auth/me',
]);

// Engine-to-hub server calls (no browser cookie available)
const UNPROTECTED_PREFIXES = ['/api/v1/hub/'];

export async function authMiddleware(c: Context, next: Next) {
  const path = c.req.path;

  if (UNPROTECTED_PATHS.has(path)) {
    return next();
  }

  if (UNPROTECTED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return next();
  }

  const token = getCookie(c, 'token');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    await verify(token, JWT_SECRET, 'HS256');
    return next();
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
}

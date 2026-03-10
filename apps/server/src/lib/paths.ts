import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// apps/server/dist/ -> monorepo root (3 levels up, tsup bundles into single file)
const MONOREPO_ROOT = path.resolve(__dirname, '..', '..', '..');

export function getAwRoot(): string {
  return process.env['AW_ROOT'] ?? MONOREPO_ROOT;
}

#!/usr/bin/env node

/**
 * gen-jwt-secret.mjs — Generate a cryptographically secure JWT_SECRET
 * and write it to .env.
 *
 * Usage:
 *   node infra/scripts/gen-jwt-secret.mjs
 */

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const ENV_FILE = resolve(ROOT, ".env");

const secret = randomBytes(64).toString("base64url");

let content;
try {
  content = readFileSync(ENV_FILE, "utf-8");
} catch {
  console.error(`Arquivo nao encontrado: ${ENV_FILE}`);
  process.exit(1);
}

const regex = /^JWT_SECRET=.*$/m;

if (!regex.test(content)) {
  console.error("JWT_SECRET nao encontrado no .env");
  process.exit(1);
}

const updated = content.replace(regex, `JWT_SECRET=${secret}`);
writeFileSync(ENV_FILE, updated, "utf-8");

console.log("JWT_SECRET gerado e salvo no .env");

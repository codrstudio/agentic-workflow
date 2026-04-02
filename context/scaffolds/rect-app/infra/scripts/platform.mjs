#!/usr/bin/env node

/**
 * platform.mjs — Wrapper do docker compose que injeta vars de context/settings.yml.
 *
 * Lê settings.yml, descriptografa campos sensíveis (ENC(...)) e passa como env
 * vars para o docker compose, sem precisar tê-los no .env.
 *
 * Mapeamento settings.yml → env var:
 *   infrastructure.ngrok.authtoken  → NGROK_AUTHTOKEN
 *   infrastructure.ngrok.domain     → NGROK_DOMAIN
 *   infrastructure.whisper.model    → WHISPER_MODEL
 *   infrastructure.whisper.compute-type → WHISPER_COMPUTE_TYPE
 *
 * Usage (via npm scripts):
 *   node infra/scripts/platform.mjs up -d
 *   node infra/scripts/platform.mjs down
 *   node infra/scripts/platform.mjs ps
 *   node infra/scripts/platform.mjs logs -f
 */

import { scryptSync, createDecipheriv } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { load as yamlLoad } from "js-yaml";

const ROOT = resolve(import.meta.dirname, "../..");
const ENV_FILE = resolve(ROOT, ".env");

// ── Load .env ────────────────────────────────────────────────────────

function loadDotenv(filePath) {
  if (!existsSync(filePath)) return {};
  const env = {};
  const lines = readFileSync(filePath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = val;
  }
  // Second pass: interpolate ${VAR} references
  for (const key of Object.keys(env)) {
    env[key] = env[key].replace(/\$\{([^}]+)\}/g, (_, k) => env[k.trim()] ?? process.env[k.trim()] ?? "");
  }
  return env;
}

// ── AES-256-GCM decrypt (mirrors apps/backbone/src/utils/encryption.ts) ──

const SALT = Buffer.from("agentic-backbone-encryption-salt", "utf-8");
const PREFIX = "ENC(";
const SUFFIX = ")";

function deriveKey(secret) {
  return scryptSync(secret, SALT, 32);
}

function decrypt(encrypted, key) {
  if (!encrypted.startsWith(PREFIX) || !encrypted.endsWith(SUFFIX)) return encrypted;
  const payload = Buffer.from(encrypted.slice(PREFIX.length, -SUFFIX.length), "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const ciphertext = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 });
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
}

function decryptObj(obj, key) {
  if (typeof obj !== "object" || obj === null) return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "object" && v !== null) {
      result[k] = decryptObj(v, key);
    } else if (typeof v === "string" && v.startsWith(PREFIX)) {
      result[k] = decrypt(v, key);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ── Read settings.yml ────────────────────────────────────────────────

function loadSettings(contextFolder, jwtSecret) {
  const settingsPath = join(contextFolder, "settings.yml");
  if (!existsSync(settingsPath)) return {};
  const raw = readFileSync(settingsPath, "utf-8");
  const parsed = yamlLoad(raw) ?? {};
  const key = deriveKey(jwtSecret);
  return decryptObj(parsed, key);
}

// ── Map settings → env vars ──────────────────────────────────────────

function settingsToEnv(settings) {
  const env = {};
  const infra = settings?.infrastructure ?? {};
  const ngrok = infra?.ngrok ?? {};
  const whisper = infra?.whisper ?? {};

  if (whisper.model) env.WHISPER_MODEL = whisper.model;
  if (whisper["compute-type"]) env.WHISPER_COMPUTE_TYPE = whisper["compute-type"];

  return env;
}

// ── Main ─────────────────────────────────────────────────────────────

const dotenv = loadDotenv(ENV_FILE);
const merged = { ...process.env, ...dotenv };

const jwtSecret = merged.JWT_SECRET;
if (!jwtSecret) {
  console.error("❌ JWT_SECRET não encontrado no .env");
  process.exit(1);
}

const contextFolder = resolve(ROOT, merged.CONTEXT_FOLDER ?? "context");
const settings = loadSettings(contextFolder, jwtSecret);
const settingsEnv = settingsToEnv(settings);

const finalEnv = { ...merged, ...settingsEnv };

const args = process.argv.slice(2);
const isUp = args[0] === "up";
const composeArgs = [
  "compose",
  "-f", "infra/docker-compose.platform.yml",
  "-f", "infra/docker-compose.platform.dev-ports.yml",
  ...args,
  ...(isUp ? ["--remove-orphans"] : []),
];

const result = spawnSync("docker", composeArgs, {
  stdio: "inherit",
  env: finalEnv,
  cwd: ROOT,
});

process.exit(result.status ?? 0);

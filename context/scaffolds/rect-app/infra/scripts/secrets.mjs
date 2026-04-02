#!/usr/bin/env node

/**
 * secrets.mjs — Encrypt/decrypt .env files via SOPS + age.
 *
 * Usage:
 *   node infra/scripts/secrets.mjs decrypt [environment]   # default: development
 *   node infra/scripts/secrets.mjs encrypt [environment]   # default: development
 *
 * Key resolution (in order):
 *   1. SOPS_AGE_KEY env var (CI/automation)
 *   2. .enc.key file (local convenience)
 *   3. Interactive prompt (first-time setup)
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const ENV_FILE = resolve(ROOT, ".env");
const KEY_FILE = resolve(ROOT, ".enc.key");

const [action = "decrypt", environment = "development"] = process.argv.slice(2);
const ENC_FILE = resolve(ROOT, `.env.${environment}.enc`);

// ── Key resolution ──────────────────────────────────────────────────

async function resolveKey() {
  // 1. Env var
  if (process.env.SOPS_AGE_KEY) {
    return process.env.SOPS_AGE_KEY;
  }

  // 2. .enc.key file
  if (existsSync(KEY_FILE)) {
    const key = readFileSync(KEY_FILE, "utf-8").trim();
    if (key) return key;
  }

  // 3. Interactive prompt
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const key = await new Promise((res) => {
    rl.question("🔑 Cole a chave age (AGE-SECRET-KEY-...): ", (answer) => {
      rl.close();
      res(answer.trim());
    });
  });

  if (!key.startsWith("AGE-SECRET-KEY-")) {
    console.error("❌ Chave inválida.");
    process.exit(1);
  }

  // Offer to save
  const rl2 = createInterface({ input: process.stdin, output: process.stderr });
  const save = await new Promise((res) => {
    rl2.question("💾 Salvar em .enc.key para próximos usos? (S/n): ", (answer) => {
      rl2.close();
      res(!answer || answer.toLowerCase().startsWith("s"));
    });
  });

  if (save) {
    writeFileSync(KEY_FILE, key + "\n", "utf-8");
    console.error("✅ Chave salva em .enc.key");
  }

  return key;
}

// ── Actions ─────────────────────────────────────────────────────────

async function decrypt() {
  if (!existsSync(ENC_FILE)) {
    console.error(`❌ Arquivo não encontrado: ${ENC_FILE}`);
    process.exit(1);
  }

  const key = await resolveKey();

  execSync(`sops decrypt --input-type dotenv --output-type dotenv "${ENC_FILE}" > "${ENV_FILE}"`, {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env, SOPS_AGE_KEY: key },
    shell: true,
    cwd: ROOT,
  });

  console.log(`✅ Decriptado: .env.${environment}.enc → .env`);
}

async function encrypt() {
  if (!existsSync(ENV_FILE)) {
    console.error(`❌ Arquivo não encontrado: ${ENV_FILE}`);
    process.exit(1);
  }

  // Normalize CRLF → LF before encrypting
  const content = readFileSync(ENV_FILE, "utf-8").replace(/\r\n/g, "\n");
  writeFileSync(ENV_FILE, content, "utf-8");

  execSync(`sops encrypt --input-type dotenv --output-type dotenv --filename-override ".env.${environment}.enc" "${ENV_FILE}" > "${ENC_FILE}"`, {
    stdio: ["inherit", "inherit", "inherit"],
    env: { ...process.env },
    shell: true,
    cwd: ROOT,
  });

  console.log(`✅ Encriptado: .env → .env.${environment}.enc`);
}

// ── Main ────────────────────────────────────────────────────────────

if (action === "decrypt") {
  await decrypt();
} else if (action === "encrypt") {
  await encrypt();
} else {
  console.error(`Uso: node infra/scripts/secrets.mjs <decrypt|encrypt> [environment]`);
  process.exit(1);
}

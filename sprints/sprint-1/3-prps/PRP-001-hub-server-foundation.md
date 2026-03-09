# PRP-001 — Hub Server Foundation

**Specs:** S-001
**Prioridade:** 1 (base de toda a arquitetura)
**Dependências:** nenhuma

## Objetivo

Criar o servidor HTTP backend (Hono) que serve como hub central entre a engine e o frontend. A engine já faz POST/PATCH para `AW_HUB_URL` via `AgentActionReporter`. Este PRP entrega o scaffolding do hub como novo workspace package `@aw/hub`.

## Escopo

- **Package:** `apps/hub/` como workspace no monorepo
- **Server:** Hono com Node.js adapter
- **Middleware:** CORS (permite localhost:5173), JSON body parser, request logging
- **Endpoints:** `GET /api/v1/health`
- **Config:** Porta via `PORT` env (default 3000), dotenv
- **Build:** tsup (ESM output), scripts `dev` e `build`
- **Monorepo:** Adicionar ao root `package.json` workspaces, scripts `dev:hub`, `build:hub`

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-001 | Hub Package Scaffolding | Criar `apps/hub/` com package.json, tsconfig.json, tsup.config.ts. Registrar no root workspaces. |
| F-002 | Hono Server + Middleware | Criar app Hono com CORS, JSON body parser, request logger. Entry point `src/index.ts` que inicia o servidor. |
| F-003 | Health Check Endpoint | `GET /api/v1/health` retornando `{ status, uptime, timestamp }`. Estrutura modular de rotas em `src/routes/`. |

## Limites

- NÃO implementa autenticação (PRP-002)
- NÃO implementa endpoints de negócio (projetos, runs, SSE)
- NÃO configura proxy do frontend para o hub

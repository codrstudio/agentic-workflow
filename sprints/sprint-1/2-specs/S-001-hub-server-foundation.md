# S-001 — Hub Server Foundation

**Discoveries:** D-001 (score 10)

## Objetivo

Criar o servidor HTTP backend (Hono) que serve como hub central entre a engine e o frontend. A engine já faz POST/PATCH para `AW_HUB_URL` (default `http://localhost:3000`) via `AgentActionReporter`. O hub precisa existir para receber esses requests e expor APIs para o frontend.

## Escopo

- Criar `apps/hub/` como novo workspace package (`@aw/hub`)
- Servidor Hono com Node.js adapter
- Middleware: CORS, JSON body parser, request logging
- Health-check endpoint: `GET /api/v1/health`
- Estrutura de rotas modular (`/api/v1/...`)
- Carregamento de variáveis de ambiente via dotenv (`.env` na raiz)
- Script `dev` com watch mode
- Script `build` com tsup (ESM output)
- Porta configurável via `PORT` env (default 3000)

## Estrutura de Diretórios

```
apps/hub/
  src/
    index.ts              # Entry point — cria e inicia o servidor
    app.ts                # Hono app com middleware global
    routes/
      health.ts           # GET /api/v1/health
      index.ts            # Barrel que monta todas as rotas
    middleware/
      logger.ts           # Request logging middleware
  package.json
  tsconfig.json
  tsup.config.ts
```

## API Endpoints

### `GET /api/v1/health`

**Response 200:**
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-03-09T12:00:00Z"
}
```

## Dependências

- `hono` — HTTP framework
- `@hono/node-server` — Node.js adapter
- `dotenv` — Environment variables
- `tsup` — Bundler
- `typescript` — Type checking

## Integração com Monorepo

- Adicionar `apps/hub` ao `workspaces` no root `package.json`
- Adicionar scripts no root: `dev:hub`, `build:hub`
- Atualizar `dev:all` para incluir o hub

## Critérios de Aceite

1. `npm run dev:hub` inicia o servidor na porta 3000
2. `GET /api/v1/health` retorna 200 com JSON válido
3. CORS permite requests do frontend (localhost:5173)
4. Logs de request aparecem no console
5. Build com `npm run build:hub` gera `apps/hub/dist/index.js`
6. TypeScript compila sem erros (`npm run typecheck` no workspace)

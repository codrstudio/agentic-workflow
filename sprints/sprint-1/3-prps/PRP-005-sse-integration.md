# PRP-005 — Integração SSE

**Specs:** S-006
**Prioridade:** 5
**Dependências:** PRP-001, PRP-004

## Objetivo

Conectar o pipeline de eventos da engine ao frontend via SSE. A engine já emite `EngineEvent` via `Notifier` → `SSEAdapter`. O hub precisa receber esses eventos e repassá-los aos clientes SSE conectados no browser.

## Escopo

### Backend (apps/hub)

- Endpoint SSE: `GET /api/v1/sse` com headers `text/event-stream`
- EventEmitter interno para broadcast de eventos
- Keepalive a cada 30s (`:keepalive\n\n`)
- Fontes de eventos:
  1. Engine child process (stdout/events quando spawned via PRP-004)
  2. AgentActionReporter (`POST/PATCH agent-actions` que a engine já chama)
- Endpoints para `AgentActionReporter`:
  - `POST /api/v1/hub/projects/:slug/agent-actions` → armazena + emite SSE
  - `PATCH /api/v1/hub/projects/:slug/agent-actions/:id` → atualiza + emite SSE

### Frontend (apps/web)

- Hook `useSSE()` — conexão ao `/api/v1/sse`, reconexão com backoff exponencial
- Ring buffer de últimos N eventos
- API de subscribe por tipo de evento
- Indicador visual de conexão SSE (connected/reconnecting/disconnected)

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-015 | SSE Endpoint + Event Bus | `GET /api/v1/sse` com streaming SSE. EventEmitter interno no hub. Keepalive 30s. Integração com child process da engine (captura de eventos). |
| F-016 | Agent Actions Endpoints | `POST /api/v1/hub/projects/:slug/agent-actions` e `PATCH .../agent-actions/:id`. Armazenamento em memória. Emissão de eventos SSE `agent:action:start` e `agent:action:end`. |
| F-017 | useSSE Hook + Connection Indicator | Hook React `useSSE()` com conexão, reconexão backoff, ring buffer, subscribe por tipo. Componente indicador de status SSE no layout. |

## Limites

- NÃO implementa UI de visualização de agent actions (PRP-009)
- NÃO implementa feed de eventos (PRP-009)
- NÃO implementa persistência de eventos (em memória apenas)

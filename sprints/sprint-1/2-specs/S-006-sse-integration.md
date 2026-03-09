# S-006 — Integração SSE Engine → Hub → Frontend

**Discoveries:** D-007 (score 8)

## Objetivo

Conectar o pipeline de eventos da engine ao frontend via SSE. A engine já emite `EngineEvent` via `Notifier` → `SSEAdapter`. O hub precisa receber esses eventos e repassá-los aos clientes conectados.

## Escopo

### Backend (apps/hub)

- Endpoint SSE: `GET /api/v1/sse`
- O hub mantém um EventEmitter interno para broadcast
- Duas fontes de eventos:
  1. **Engine child process**: quando o hub spawna a engine (S-005), conecta stdout/events
  2. **AgentActionReporter**: endpoints `POST/PATCH agent-actions` que a engine já chama

### Frontend (apps/web)

- Hook `useSSE()` que conecta ao `/api/v1/sse` e mantém a conexão aberta
- Reconexão automática com backoff exponencial
- Estado global de eventos acessível por toda a app
- Indicador de conexão SSE (connected/reconnecting/disconnected)

## API Endpoints

### `GET /api/v1/sse`

**Headers de resposta:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

**Formato dos eventos:**
```
event: workflow:start
data: {"type":"workflow:start","timestamp":"2026-03-09T12:00:00Z","data":{"project":"aw-monitor","workflow":"vibe-app"}}

event: feature:pass
data: {"type":"feature:pass","timestamp":"2026-03-09T12:01:00Z","data":{"feature_id":"F-001","name":"Login"}}
```

- Keepalive a cada 30s: `:keepalive\n\n`
- Event name = `EngineEvent.type`

### `POST /api/v1/hub/projects/:slug/agent-actions`

Já especificado pela engine (`AgentActionReporter`). O hub:
1. Armazena a action em memória
2. Emite evento SSE `agent:action:start`

### `PATCH /api/v1/hub/projects/:slug/agent-actions/:id`

O hub:
1. Atualiza a action em memória
2. Emite evento SSE `agent:action:end`

## Hook Frontend

```typescript
function useSSE(): {
  connected: boolean
  events: EngineEvent[]      // últimos N eventos (ring buffer)
  lastEvent: EngineEvent | null
  subscribe: (type: string, callback: (event: EngineEvent) => void) => () => void
}
```

## Critérios de Aceite

1. `GET /api/v1/sse` retorna stream SSE com keepalive
2. Eventos da engine são repassados ao stream SSE
3. `POST/PATCH agent-actions` emitem eventos SSE correspondentes
4. Hook `useSSE()` conecta e recebe eventos
5. Reconexão automática quando a conexão cai
6. Indicador visual de status da conexão SSE no frontend

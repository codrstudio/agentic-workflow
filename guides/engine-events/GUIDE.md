# Canal Unificado de Eventos: Engine → Server → SSE

## Arquitetura

```
Engine:
  Notifier.emitEngineEvent(event)
       │
       ├─── Consumer 1: CLI listener → logEvent() [texto humano no terminal]
       │                             → writeLogEvent() [engine.jsonl]
       │
       └─── Consumer 2: EngineEventForwarder → POST /api/v1/hub/engine-events

Server:
  POST /api/v1/hub/engine-events → eventBus.broadcast()
  GET  /api/v1/events            → streamSSE (EventSource)
```

O `Notifier` é o **único canal de emissão**. Não existe mais `AgentActionReporter`.

---

## Como emitir um evento

### Na engine (workflow-engine.ts, feature-loop.ts, operator-queue.ts)

Use sempre o método privado `emitEvent()` de cada classe — nunca chame `notifier.emitEngineEvent()` diretamente nos step runners.

```ts
// workflow-engine.ts
this.emitEvent('agent:spawn', { task: taskSlug, agent: agentName, mode: 'call' });
this.emitEvent('agent:exit', { task: taskSlug, exit_code: result.code, timed_out: result.timedOut });

// feature-loop.ts
await this.emitEvent('feature:start', ctx, { feature_id: feature.id, feature_name: feature.name });
await this.emitEvent('feature:pass', ctx, { feature_id: feature.id, feature_name: feature.name });

// operator-queue.ts
this.emitEvent('queue:done', { exit_code: result.code, timed_out: result.timedOut }, config.projectSlug, config.waveNumber);
```

### Campos obrigatórios em todos os eventos

`project_slug` e `wave_number` são adicionados automaticamente pelos `emitEvent()` internos:

- `workflow-engine.ts`: lê de `this._runCtx` (setado no início de `execute()`)
- `feature-loop.ts`: lê de `ctx.projectSlug` / `ctx.waveNumber`
- `operator-queue.ts`: recebe como parâmetros opcionais

---

## Schema (`apps/engine/src/schemas/event.ts`)

`EngineEvent` é um discriminated union com 24 tipos. Campos top-level presentes em todos:

```ts
{
  type: EngineEventType,   // discriminant
  timestamp: string,
  project_slug?: string,
  wave_number?: number,
  data: { /* shape específico por tipo */ }
}
```

### Shapes de data por grupo

| Tipo(s) | Campos em `data` |
|---|---|
| `agent:spawn` | `task`, `agent`, `mode?`, `feature_id?`, `spawn_dir?` |
| `agent:exit` | `task`, `agent?`, `exit_code`, `duration_ms?`, `timed_out`, `output_preview?` |
| `agent:output` | `task`, `agent`, `feature_id?`, `content_type`, `preview` |
| `feature:start/pass/fail/skip` | `feature_id`, `feature_name`, `retries?` |
| `workflow:start/end` | `workflow?`, `wave?`, `steps?`, `reason?` |
| `workflow:step:start/end` | `step`, `type`, `index`, `total?`, `result?` |
| `loop:start/iteration/end` | `total?`, `iteration?`, `reason?` |
| `gutter:retry/rollback/skip` | `feature_id`, `retries?` |
| `workflow:chain/spawn` | `from`, `to` |
| `workflow:resume` | `index`, `step` |
| `queue:received/processing/done` | `message?`, `count?`, `exit_code?`, `timed_out?` |

Todos os schemas usam `.passthrough()` — campos extras em `data` são permitidos sem erro.

---

## Adicionando um novo tipo de evento

### 1. Registrar o tipo no schema

```ts
// apps/engine/src/schemas/event.ts

// 1. Adicionar ao enum:
export const EngineEventTypeSchema = z.enum([
  // ...existentes...
  'meu:evento',
]);

// 2. Adicionar ao discriminated union:
base.extend({
  type: z.literal('meu:evento'),
  data: z.object({ campo: z.string() }).passthrough(),
}),
```

### 2. Emitir no call site

```ts
// Em workflow-engine.ts:
this.emitEvent('meu:evento', { campo: 'valor' });

// Em feature-loop.ts:
await this.emitEvent('meu:evento', ctx, { campo: 'valor' });
```

### 3. Exibir no terminal (opcional)

```ts
// Em apps/engine/src/cli.ts, dentro do switch de logEvent():
case 'meu:evento':
  console.log(`${ts} ${chalk.cyan('meu:evento')} ${d.campo}`);
  break;
```

---

## EngineEventForwarder (CLI → Server)

`apps/engine/src/core/engine-event-forwarder.ts`

- Instanciado em `cli.ts` **apenas se** o server responder ao HEAD `/api/v1/health` em 1s
- Fire-and-forget com timeout de 3s — falha silenciosa, nunca bloqueia a engine
- URL configurável via `AW_WEB_URL` (default: `http://localhost:3000`)

```ts
// Não instanciar manualmente — já está plugado em cli.ts
const forwarder = new EngineEventForwarder(serverUrl);
runner.notifier.on('engine:event', (event) => forwarder.forward(event));
```

---

## Rota do Server

`POST /api/v1/hub/engine-events` — recebe `EngineEvent` do CLI e faz `eventBus.broadcast()`.

Validação mínima (sem Zod no server — dependência não existe):
- `body.type` deve ser string
- `body.timestamp` deve ser string

O broadcast é entregue a todos os clientes SSE conectados em `GET /api/v1/events`.

---

## Padrão: componentes que precisam de estado em tempo real

### Regra geral

**Nunca fazer polling de dados que podem ser derivados de eventos SSE.**
O objetivo é: N clientes abertos = mesmo custo de tráfego que 1 cliente.

### Arquitetura para páginas reativas (ex: Monitor)

O servidor é o único produtor de snapshots — não o cliente.

```
Engine (CLI)                    Servidor                      Browser (N clientes)
─────────────────────────────────────────────────────────────────────────────────

engine events              ┌── MonitorService (servidor)
(step, feature, loop...)   │     • ouve eventBus
        │                  │     • timer próprio para estado
        ▼                  │       que eventos não cobrem:
POST /hub/engine-events    │       PIDs (engine_alive, agent_alive)
        │                  │       mtime de arquivo (last_output_age)
        ▼                  │     • compara com último estado
    eventBus ──────────────┘     • só faz broadcast se mudou
        │                                   │
        │                                   ▼
        │                         eventBus.broadcast()
        │                         ('monitor:snapshot')
        │                                   │
        └───────────────────────────────────┘
                                            │
                                            ▼
                                  GET /api/v1/events (SSE)
                                            │
                              ┌─────────────┴──────────────┐
                              ▼                             ▼
                         Browser 1                    Browser 2 … N
                    (renderiza snapshot)         (renderiza snapshot)
```

**Propriedade fundamental:**

| | Polling (padrão ruim) | SSE-driven (padrão correto) |
|---|---|---|
| 1 cliente, engine inativa | 20 req/min | 0 req/min |
| 10 clientes, engine inativa | **200 req/min** | **0 req/min** |
| Computação por mudança de estado | 1 por cliente | **1 no servidor** |
| Tráfego durante engine ativa | N × req/min | 1 broadcast → N clientes |

### Responsabilidades por camada

**Motor emite:** step start/end, feature pass/fail/skip, loop iteration, agent spawn/exit
**Servidor computa e broadcast:** snapshot completo quando estado muda (event-driven ou timer interno)
**Cliente faz:** 1 fetch no mount (snapshot inicial) + escuta SSE — zero polling

### Implementação no cliente

```tsx
// ✅ Correto — SSE-driven
const { subscribe } = useSSEContext()

useEffect(() => {
  // 1. snapshot inicial
  apiFetch(`/api/v1/projects/${slug}/monitor`).then(r => r.json()).then(setData)

  // 2. atualizações em tempo real
  return subscribe('monitor:snapshot', (event) => {
    const payload = event.data as { project_slug: string; data: MonitorData }
    if (payload.project_slug === slug) setData(payload.data)
  })
}, [slug])

// ❌ Errado — polling
useEffect(() => {
  fetchData()
  const interval = setInterval(fetchData, 3000) // PROIBIDO
  return () => clearInterval(interval)
}, [fetchData])
```

### Clock local para durações

Campos como `elapsed_ms` e `step_elapsed_ms` devem ser recalculados localmente a partir de `started_at` — não via rede.

```tsx
// Timer apenas para atualizar o display, sem nenhuma requisição
const [now, setNow] = useState(Date.now())
useEffect(() => {
  const id = setInterval(() => setNow(Date.now()), 1_000)
  return () => clearInterval(id)
}, [])

const elapsed = data.step_started_at ? now - new Date(data.step_started_at).getTime() : null
```

---

## O que NÃO existe mais

- `AgentActionReporter` — deletado. Não recriar.
- `POST /api/v1/hub/projects/:slug/agent-actions` — rota deletada.
- `PATCH /api/v1/hub/projects/:slug/agent-actions/:id` — rota deletada.
- `apps/server/src/routes/sse.ts` — renomeado para `events.ts`.
- `apps/server/src/routes/agent-actions.ts` — deletado.

Se precisar rastrear ciclo de vida de agentes (start/end), use os eventos `agent:spawn` e `agent:exit` via SSE.

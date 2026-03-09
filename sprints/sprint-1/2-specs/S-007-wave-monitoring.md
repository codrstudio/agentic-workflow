# S-007 — Monitoramento de Wave Ativa

**Discoveries:** D-006 (score 8), D-013 (score 6)

## Objetivo

Equivalente web ao `aw:status`. Exibir estado da wave ativa de um projeto: steps com status/timing, loop state, feature progress. Inclui dashboard do ralph-wiggum loop.

## Escopo

### Backend (apps/hub)

- Ler filesystem do workspace para compor estado
- Expor via REST (dados sob demanda, não polling)
- Atualização realtime via SSE (S-006)

### Frontend (apps/web)

- Página `/projects/:slug` com visão geral do projeto e waves
- Página `/projects/:slug/waves/:waveNumber` com:
  - Lista de steps com status (pending/running/completed/failed)
  - Timing de cada step (started_at, duration)
  - Feature loop dashboard (quando step é ralph-wiggum-loop)
  - Progress bar geral da wave

## API Endpoints

### `GET /api/v1/projects/:slug/waves`

**Response 200:**
```json
[
  {
    "number": 1,
    "status": "running",
    "started_at": "2026-03-09T12:00:00Z",
    "steps": [
      {
        "index": 1,
        "task": "compile-brainstorming",
        "type": "spawn-agent",
        "status": "completed",
        "started_at": "2026-03-09T12:00:00Z",
        "ended_at": "2026-03-09T12:05:00Z",
        "duration_ms": 300000
      },
      {
        "index": 2,
        "task": "derive-specs",
        "type": "spawn-agent",
        "status": "running",
        "started_at": "2026-03-09T12:05:00Z"
      }
    ]
  }
]
```

### `GET /api/v1/projects/:slug/waves/:waveNumber`

Retorna wave detalhada com steps + loop state (se houver).

### `GET /api/v1/projects/:slug/waves/:waveNumber/loop`

**Response 200** (quando step ralph-wiggum-loop está ativo):
```json
{
  "step_index": 6,
  "total_features": 12,
  "completed": 5,
  "passing": 4,
  "failing": 1,
  "skipped": 0,
  "pending": 7,
  "in_progress": null,
  "current_feature": {
    "id": "F-006",
    "name": "SSE Integration",
    "attempt": 2,
    "status": "in_progress"
  },
  "features": [
    {
      "id": "F-001",
      "name": "Hub Server",
      "status": "passing",
      "attempts": 1
    }
  ]
}
```

## Lógica de Leitura do Filesystem

O hub lê os seguintes arquivos do workspace:
- `context/workspaces/{slug}/wave-{n}/step-{nn}-{task}/spawn.json` → metadata do step
- `context/workspaces/{slug}/wave-{n}/step-{nn}-ralph-wiggum-loop/loop.json` → loop state
- `context/workspaces/{slug}/repo/sprints/sprint-{n}/features.json` → features com status

Status do step é derivado de:
- `spawn.json` existe e tem `exit_code` → completed (0) ou failed (non-zero)
- `spawn.json` existe sem `exit_code` → running
- Diretório do step não existe → pending

## Componentes Frontend

### WaveTimeline

- Lista vertical de steps como timeline
- Cada step: ícone de status, nome da task, tipo, duração
- Step clicável → navega para `/projects/:slug/waves/:waveNumber/steps/:stepIndex`

### FeatureLoopDashboard

- Progress ring/bar mostrando features completadas vs total
- Lista de features com badges de status (passing/failing/skipped/pending/blocked)
- Feature atual destacada com indicador de attempt
- Contador: X passing, Y failing, Z skipped

## Critérios de Aceite

1. `GET /api/v1/projects/:slug/waves` retorna lista de waves com steps
2. `GET /api/v1/projects/:slug/waves/:waveNumber/loop` retorna estado do loop
3. Página de wave exibe timeline de steps com status correto
4. Feature loop dashboard mostra progresso das features
5. Steps são clicáveis e navegam para detalhe
6. Status atualiza via SSE sem refresh manual
7. Funciona em mobile com layout responsivo

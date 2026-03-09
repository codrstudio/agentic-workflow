# PRP-006 — Monitoramento de Wave & Loop Dashboard

**Specs:** S-007
**Prioridade:** 6
**Dependências:** PRP-004, PRP-005

## Objetivo

Equivalente web ao `aw:status`. Exibir estado da wave ativa de um projeto: steps com status/timing, loop state, feature progress. Inclui dashboard do ralph-wiggum loop com contadores de pass/fail/skip.

## Escopo

### Backend (apps/hub)

- `GET /api/v1/projects/:slug/waves` — lista waves com steps
- `GET /api/v1/projects/:slug/waves/:waveNumber` — wave detalhada
- `GET /api/v1/projects/:slug/waves/:waveNumber/loop` — estado do feature loop
- Leitura do filesystem:
  - `wave-{n}/step-{nn}-{task}/spawn.json` → metadata do step
  - `wave-{n}/step-{nn}-ralph-wiggum-loop/loop.json` → loop state
  - `repo/sprints/sprint-{n}/features.json` → features com status
- Status derivado: spawn.json com exit_code → completed/failed; sem exit_code → running; dir não existe → pending

### Frontend (apps/web)

- Seção de waves na página `/projects/:slug` (cards/rows de wave)
- Página `/projects/:slug/waves/:waveNumber`:
  - WaveTimeline — lista vertical de steps como timeline (ícone status, task, tipo, duração)
  - Steps clicáveis → navegam para detalhe do step
  - Progress bar geral da wave
- FeatureLoopDashboard (quando step é ralph-wiggum-loop):
  - Progress ring/bar
  - Lista de features com badges (passing/failing/skipped/pending/blocked)
  - Feature atual destacada
  - Contadores: X passing, Y failing, Z skipped
- Atualização via SSE (PRP-005)

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-018 | Waves & Steps API | Endpoints `GET /projects/:slug/waves`, `GET .../waves/:waveNumber`, `GET .../waves/:waveNumber/loop`. Leitura de spawn.json, loop.json, features.json do filesystem. |
| F-019 | Wave Timeline UI | Página `/projects/:slug/waves/:waveNumber` com timeline vertical de steps. Ícone de status, nome da task, tipo, duração. Steps clicáveis. Progress bar da wave. Seção de waves na página do projeto. |
| F-020 | Feature Loop Dashboard | Componente FeatureLoopDashboard com progress ring, lista de features com badges de status, feature atual destacada, contadores pass/fail/skip. Atualização reativa via SSE. Layout responsivo mobile. |

## Limites

- NÃO implementa visualização de logs do step (PRP-008)
- NÃO implementa drill-down de features para tentativas individuais (coberto por PRP-008)
- NÃO persiste estado — leitura direta do filesystem a cada request

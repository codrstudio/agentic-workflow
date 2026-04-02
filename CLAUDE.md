# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**agentic-workflow** is a deterministic orchestrator that drives AI agents (Claude Code CLI) through multi-step product workflows. It reads YAML workflow definitions, spawns Claude Code processes for each step, and manages feature-level iteration with retry/rollback logic.

The monorepo has four apps and one shared package:
- **apps/engine** — The CLI orchestrator (spawns agents, manages state)
- **apps/server** — Hono HTTP server (bridges engine events to the web frontend)
- **apps/web** — React SPA (monitoring, project management, run control)
- **apps/chat** — React SPA for chat (socket.io, PWA-enabled, uses `@workspace/ui`)
- **packages/ui** — Shared UI component library (Radix UI + CVA + Tailwind, exported via `@workspace/ui`)

## Commands

```bash
# Root
npm run build          # Build engine
npm run build:web      # Build web app (vite)
npm run typecheck      # Type-check engine
npm run dev:all        # Run server + web concurrently
npm run aw:run -- <project> <workflow>   # Execute a workflow
npm run aw:status      # Check current engine/workflow status
npm run aw:message     # Send operator messages
npm run aw:watch       # Monitor operator queue
npm run aw:console     # Interactive console

# apps/engine
npm run build          # tsup (ESM + CJS + DTS)
npm run dev            # tsup --watch
npm run typecheck      # tsc --noEmit

# apps/server
npm run build          # tsup
npm run dev            # tsup --watch + auto-run
npm run typecheck      # tsc --noEmit

# apps/web
npm run dev            # vite dev server
npm run build          # tsc -b && vite build
npm run typecheck      # tsc --noEmit

# apps/chat
npm run dev            # vite dev server
npm run build          # vite build
npm run typecheck      # tsc --noEmit

# packages/ui
npm run typecheck      # tsc --noEmit
```

There are no test scripts configured. No linter is configured for engine/server/web (chat and ui have eslint).

## Project Hygiene

- **Não macule a estrutura de pastas do projeto com arquivos temporários.**
- **Arquivos temporários vão em .tmp/**

## Normas

- **PROIBIDO polling. Polling gasta trafego de rede demais a toa e nós temos custo por trafego.**
- **Use SSE para realtime**

## Layout de páginas (UI)

- **Padrão**: grid de colunas que cresce com a largura disponível. O conteúdo ocupa a(s) primeira(s) coluna(s); o espaço vazio fica à direita.
  ```tsx
  <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
    <div className="col-span-1">
      {/* conteúdo */}
    </div>
  </div>
  ```

## Guias

Leia o guia relevante antes de agir nas áreas abaixo — eles são a fonte da verdade.

| Guia | Quando ler |
|------|------------|
| [`guides/harness/GUIDE.md`](guides/harness/GUIDE.md) | Entender o harness como um todo: entidades, ciclo de vida, decisões de design |
| [`guides/project-concept/GUIDE.md`](guides/project-concept/GUIDE.md) | Criar ou modificar projetos (`context/projects/`) |
| [`guides/workspace-layout/GUIDE.md`](guides/workspace-layout/GUIDE.md) | Entender ou modificar a estrutura de workspaces/waves/worktrees |
| [`guides/engine-events/GUIDE.md`](guides/engine-events/GUIDE.md) | Emitir, consumir ou adicionar tipos de evento da engine |
| [`guides/server-logging/GUIDE.md`](guides/server-logging/GUIDE.md) | Configurar ou modificar o logging do servidor (pino + LOG_LEVEL) |

## Eventos da Engine

O canal de eventos é unificado via `Notifier`. Guia completo: [`guides/engine-events/GUIDE.md`](guides/engine-events/GUIDE.md)

Regras obrigatórias ao mexer em `workflow-engine.ts`, `feature-loop.ts` ou `operator-queue.ts`:
- **Nunca recriar `AgentActionReporter`** — foi deletado intencionalmente.
- **Emitir eventos via `emitEvent()` privado** de cada classe — não chamar `notifier.emitEngineEvent()` diretamente nos step runners.
- **Novos tipos de evento** exigem: (1) entrada no enum `EngineEventTypeSchema`, (2) entrada no `z.discriminatedUnion` em `apps/engine/src/schemas/event.ts`, (3) case no `logEvent()` de `cli.ts`.
- `project_slug` e `wave_number` são adicionados automaticamente pelos `emitEvent()` internos — não passar manualmente.

## Architecture

### Monorepo Structure

- **Root**: npm workspaces with `apps/*` and `packages/*`
- **context/**: Markdown/YAML definitions consumed at runtime (not compiled):
  - `agents/` — Agent profiles (`coder.md`, `researcher.md`, `general.md`, `x-playtester.md`) with frontmatter config (allowedTools, max_turns, rollback, timeout)
  - `tasks/` — Task definitions with frontmatter specifying which agent to use
  - `workflows/` — YAML workflow definitions (`vibe-app.yaml`, `vibe-full-app.yaml`, `x-vibe-game.yaml`)
  - `projects/{slug}/` — Project definitions (project.json + sources + artifacts)
  - `workspaces/{slug}/` — Workspace instances (created automatically by engine)

### WorScaffolds Layout

```
context/scaffolds/{slug}/       # scaffold project to be copied over
```

### Workspace Layout

A workspace is created automatically by the engine from (project, workflow) parameters:

```
context/workspaces/{slug}/      # git repo (harness state)
  workspace.json
  repo/                         # product repo (clone or git init)
    sprints/
      sprint-{n}/
        1-brainstorming/
        2-specs/
        3-prps/
        features.json           # feature list for ralph-wiggum loop
  wave-{n}/
    worktree/                   # git worktree of repo (agent's cwd)
    step-{nn}-{task}/
      spawn.json                # metadata (task, agent, pid, timing)
      spawn.jsonl               # claude CLI output log
    step-{nn}-ralph-wiggum-loop/
      loop.json
      F-XXX-attempt-1/
        spawn.json
        spawn.jsonl
    merge/
      spawn.json
      spawn.jsonl
```

### Engine Core (`apps/engine/src/core/`)

The engine follows a **deterministic orchestrator + autonomous agents** pattern:

- **WorkflowRunner** (`workflow-engine.ts`): Top-level sequential step executor. Manages stop signals, background promise tracking. Handles merge post-workflow (3-layer hybrid) and chain-workflow with new wave creation.
- **FeatureLoop** (`feature-loop.ts`): The "ralph-wiggum loop" — picks the highest-priority failing feature with passing deps, spawns an agent per feature, handles pass/fail/retry/rollback/skip. Escalation: simple retry → rollback + context rotation → permanent skip.
- **AgentSpawner** (`agent-spawner.ts`): Resolves task markdown → agent profile, composes prompts, spawns `claude` CLI as child process. Writes `spawn.json` (metadata) and `spawn.jsonl` (CLI output). Supports `--json-schema` for structured responses.
- **Bootstrap** (`bootstrap.ts`): Loads project config, workflow YAML, creates workspace/repo/wave/worktree/sprint scaffolding. Detects resume state via `workflow-state.json`.
- **OperatorQueue** (`operator-queue.ts`): Drains batched operator messages, spawns agent with composed prompt, writes `operator-log.jsonl`.
- **Notifier** / **SSEAdapter**: Unified event emission. `EngineEventForwarder` forwards events to server via `POST /api/v1/hub/engine-events`.

### 5 Step Types

1. **`spawn-agent`** — Execute a task once. Optional `stop_on` evaluates the response to decide halt/continue. The `merge-worktree` task name is intercepted here for the 3-layer hybrid merge.
2. **`ralph-wiggum-loop`** — Iterates over `features.json`. Each feature gets its own attempt directory.
3. **`chain-workflow`** — Spawns merge for current wave in background, bootstraps a new wave, recurses.
4. **`spawn-workflow`** — Runs a sub-workflow in the background (parallel).
5. **`stop-on-wave-limit`** — Halts if the current wave number has reached the project's `wave_limit`.

### Merge Strategy (3-Layer Hybrid)

Applied automatically for `merge-worktree` steps:
1. **Deterministic**: Engine attempts `git merge` via `execSync`. Captures SHA if successful.
2. **Agent Fallback**: If deterministic fails, spawns agent with `--json-schema` requiring `{ success, merged_sha, error }`.
3. **Verification**: Engine validates merged SHA exists in `git log target_branch`. HARD FAIL if not found.

### Server (`apps/server/src/`)

Hono server bridging engine events to the web frontend.

Key routes:
- `GET /api/v1/events` — SSE stream (streamSSE with 30s keepalive)
- `POST /api/v1/hub/engine-events` — Receives events from CLI, broadcasts via eventBus
- `GET/POST /api/v1/projects` — Project CRUD
- `GET /api/v1/waves`, `/api/v1/runs` — Wave/run history
- `GET /api/v1/monitor` — Live wave state + feature status
- `GET /api/v1/crashes` — Crash reports
- `POST /api/v1/messages` — Enqueue operator messages
- `GET /api/v1/pid` — Engine process liveness

### Web (`apps/web/src/`)

React 19 + TanStack Router + Tailwind CSS SPA.

Key patterns:
- **SSE**: `useSSE()` hook wraps EventSource with auto-reconnect + ring buffer. Context: `sse-context.tsx`. Status dot: `sse-indicator.tsx`.
- **Auth**: JWT stored in localStorage. `auth-context.tsx` + `auth.store.ts`. Route guard in `router/index.tsx`.
- **API**: `lib/api.ts` wraps fetch with auth header injection.

### SSE Event Flow

```
Engine (Notifier) → EngineEventForwarder → POST /hub/engine-events
                                                      ↓
                                               eventBus.broadcast()
                                                      ↓
                                            GET /events (streamSSE)
                                                      ↓
                                         useSSE() hook (EventSource)
```

### Schemas (`apps/engine/src/schemas/`)

All schemas use Zod. Key files:
- `workflow.ts` — WorkflowStep discriminated union (5 step types)
- `event.ts` — EngineEvent discriminated union (24 event types)
- `feature.ts` — Feature (F-XXX id, status enum, deps, priority)
- `project.ts` — ProjectConfig (slug, name, repo, source/target folders, params, wave_limit)
- `workflow-state.ts` — Per-step status tracking (pending/running/completed/failed/interrupted)

### Template Variables

Agent/task markdown uses `{variable}` placeholders resolved at runtime:

| Variable | Description |
|----------|-------------|
| `{workspace}` | Workspace root directory |
| `{project}` | Project artifacts directory (target_folder from project.json) |
| `{repo}` | Product repo root |
| `{worktree}` | Git worktree directory (agent's cwd) |
| `{sprint}` | Current sprint directory (`repo/sprints/sprint-{n}/`) |
| `{wave_number}` | Current wave number |
| `{sprint_number}` | Current sprint number |

Plus any string values from `project.params`.

### Process Tree

```
engine CLI
  claude (child) — step-01-...
  claude (child) — step-02-...
  claude (child) — step-N ralph-wiggum iteration 1
  claude (child) — step-N ralph-wiggum iteration 2
  ...
  claude (child) — merge-worktree (background, post-workflow)
```

## TypeScript Config

- Target: ES2022, module: ESNext, bundler resolution
- Strict mode with `noUncheckedIndexedAccess`
- Node >= 20 required

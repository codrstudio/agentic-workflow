# agentic-workflow

Deterministic orchestrator that drives AI agents (Claude Code CLI) through multi-step product workflows. It reads YAML workflow definitions, spawns Claude Code processes for each step, and manages feature-level iteration with retry/rollback logic.

## Monorepo Structure

| App | Description |
|-----|-------------|
| `apps/engine` | CLI orchestrator — spawns agents, manages state, executes workflows |
| `apps/server` | Hono HTTP server — bridges engine events to the web frontend via SSE |
| `apps/web` | React SPA — monitoring, project management, run control |
| `apps/chat` | Chat interface |
| `packages/ui` | Shared UI components |

### Context Directory

Runtime definitions consumed by the engine (not compiled):

- `context/agents/` — Agent profiles with frontmatter config (allowedTools, max_turns, rollback, timeout)
- `context/tasks/` — Task definitions specifying which agent to use
- `context/workflows/` — YAML workflow definitions
- `context/projects/{slug}/` — Project definitions (project.json + sources + artifacts)
- `context/workspaces/{slug}/` — Workspace instances (created automatically by engine)

## Prerequisites

- Node.js >= 20
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated

## Setup

```bash
npm install
cp .env.example .env   # configure environment variables
npm run build
```

## Usage

```bash
# Run a workflow
npm run aw:run -- <project> <workflow>

# Check engine/workflow status
npm run aw:status

# Send operator messages
npm run aw:message

# Monitor operator queue
npm run aw:watch

# Interactive console
npm run aw:console
```

## Development

```bash
# Run server + web concurrently (with hot reload)
npm run dev:all

# Build individual apps
npm run build          # engine
npm run build:web      # web app

# Type-check
npm run typecheck
```

## Architecture

The engine follows a **deterministic orchestrator + autonomous agents** pattern:

1. **WorkflowRunner** — Sequential step executor with stop signals and background promise tracking
2. **FeatureLoop** — Iterates over features, spawns agents, handles pass/fail/retry/rollback/skip
3. **AgentSpawner** — Resolves tasks to agent profiles, composes prompts, spawns `claude` CLI processes
4. **Notifier + SSEAdapter** — Unified event emission from engine to server to web frontend

### Step Types

| Type | Description |
|------|-------------|
| `spawn-agent` | Execute a task once, with optional `stop_on` evaluation |
| `ralph-wiggum-loop` | Iterate over features — each gets its own attempt directory |
| `chain-workflow` | Merge current wave in background, bootstrap new wave, recurse |
| `spawn-workflow` | Run a sub-workflow in parallel |
| `stop-on-wave-limit` | Halt if wave number reaches project limit |

### Event Flow

```
Engine (Notifier)
  → EngineEventForwarder
    → POST /hub/engine-events
      → eventBus.broadcast()
        → GET /events (SSE)
          → useSSE() hook (EventSource)
```

## License

Private — all rights reserved.

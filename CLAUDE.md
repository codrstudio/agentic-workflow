# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**agentic-workflow** is a deterministic orchestrator that drives AI agents (Claude Code CLI) through multi-step product workflows. It reads YAML workflow definitions, spawns Claude Code processes for each step, and manages feature-level iteration with retry/rollback logic.

## Commands

```bash
npm run build        # Build the engine (tsup -> apps/engine/dist/)
npm run typecheck    # Type-check without emitting (tsc --noEmit)
npm run dev          # Build in watch mode
npm run aw:run -- <project> <workflow>  # Run harness

# Engine-specific (from apps/engine/)
npm run build        # tsup
npm run typecheck    # tsc --noEmit
```

There are no test scripts configured. No linter is configured.

## Architecture

### Monorepo Structure

- **Root**: npm workspaces with `apps/*`
- **apps/engine** (`@aw/engine`): The only package. ESM + CJS dual output via tsup. All source in `apps/engine/src/`.
- **context/**: Markdown/YAML definitions consumed at runtime (not compiled):
  - `agents/` — Agent profiles (coder.md, researcher.md, general.md) with frontmatter config (allowedTools, max_turns, rollback, timeout)
  - `tasks/` — Task definitions (pain-gain-analysis.md, derive-specs.md, etc.) with frontmatter specifying which agent to use
  - `workflows/` — YAML workflow definitions (e.g., vibe-app.yaml)
  - `projects/{slug}/` — Project definitions (project.json + sources + artifacts)
  - `workspaces/{slug}/` — Workspace instances (created automatically by engine)

### Workspace Layout

A workspace is created automatically by the engine from (project, workflow) parameters:

```
context/workspaces/{slug}/      # git repo (harness state)
  workspace.json                # reference to project + workflow
  repo/                         # product repo (clone or git init)
    sprints/
      sprint-{n}/               # deliverable artifact set
        1-brainstorming/        # pain-gain, ranking
        2-specs/                # derived specs
        3-prps/                 # derived PRPs
        features.json           # feature list for ralph-wiggum loop
  wave-{n}/                     # one per workflow execution
    worktree/                   # git worktree of repo (agent's cwd)
    step-{nn}-{task}/           # output per step
      spawn.json                # metadata (task, agent, pid, timing)
      spawn.jsonl               # claude CLI output log
    step-{nn}-ralph-wiggum-loop/
      loop.json                 # loop state
      F-XXX-attempt-1/          # per-feature attempt
        spawn.json
        spawn.jsonl
    merge/                      # post-workflow merge (background)
      spawn.json
      spawn.jsonl
```

- **workspace** is a git repo tracking harness state (wave dirs, metadata)
- **repo** is the product repository agents deliver into
- **worktree** = git worktree of repo, isolated per wave
- **wave-{n}/** directories are created per workflow execution
- **sprint-{n}/** inside repo holds deliverable artifacts grouped by phase

### Engine Core (`apps/engine/src/core/`)

The engine follows a **deterministic orchestrator + autonomous agents** pattern:

- **WorkflowRunner** (`workflow-engine.ts`): Top-level sequential step executor. Reads a `Workflow` (parsed from YAML), iterates steps through 4 step types. Handles merge post-workflow and chain-workflow with new wave creation.
- **FeatureLoop** (`feature-loop.ts`): The "ralph-wiggum loop" — picks the highest-priority failing feature with passing deps, spawns an agent with task + feature context, handles pass/fail/retry/skip. Writes `loop.json` per step dir, attempt dirs per feature.
- **AgentSpawner** (`agent-spawner.ts`): Resolves task markdown -> agent profile, composes prompts, spawns `claude` CLI as child process. Writes `spawn.json` (metadata) and `spawn.jsonl` (CLI output) to output directory. Supports `--json-schema` for structured responses.
- **Bootstrap** (`bootstrap.ts`): Loads project config, workflow YAML, creates workspace/repo/wave/worktree/sprint scaffolding.
- **FeatureSelector** (`feature-selector.ts`): Dependency-aware feature selection. Computes blocked status, picks next actionable feature.
- **GutterDetector** (`gutter-detector.ts`): Retry/rollback/skip logic based on failure count.
- **StateManager** (`state-manager.ts`): JSON/features file I/O.
- **TemplateRenderer** (`template-renderer.ts`): `{variable}` interpolation in markdown templates + YAML frontmatter parsing.
- **WorktreeManager** (`worktree-manager.ts`): Git worktree create/cleanup.
- **Notifier** / **SSEAdapter**: Event emission for engine lifecycle events.

### 4 Step Types

1. **`spawn-agent`** — Execute a task once. Agent runs, exit code determines success.
2. **`spawn-agent-call`** — Execute a task once with `--json-schema`. Agent returns structured JSON. An arrow function (`stop_on`) evaluates the response to decide halt/continue.
3. **`ralph-wiggum-loop`** — Iterates over `features.json` in the sprint dir. Each feature gets its own attempt directory. Retries, rollback, and skip via GutterDetector.
4. **`chain-workflow`** — Spawns merge for current wave in background, bootstraps a new wave, then invokes the workflow recursively.

### Schemas (`apps/engine/src/schemas/`)

All schemas use Zod. Key types:
- **Workflow/WorkflowStep**: YAML workflow definition with discriminated union on step `type` (4 types above)
- **Feature**: `F-XXX` ID format, status enum (failing/passing/skipped/pending/in_progress/blocked), dependency tracking
- **ProjectConfig**: Project definition (name, slug, repo URL, source/target folders, params)

### Data Flow

1. CLI receives (project-slug, workflow-slug)
2. Bootstrap: loads project.json, workflow YAML, creates workspace/repo/wave/worktree
3. `WorkflowRunner.execute()` steps through the workflow sequentially
4. For `spawn-agent`: resolves task.md -> agent profile.md -> renders prompt -> spawns `claude` CLI
5. For `spawn-agent-call`: same but with `--json-schema`, evaluates `stop_on` against response
6. For `ralph-wiggum-loop`: iterates features, one spawn per feature per attempt
7. For `chain-workflow`: merge current wave (background), bootstrap new wave, recurse
8. Post-workflow: engine spawns merge agent in background

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
engine (parent)
  claude (child) — step-01-pain-gain-analysis
  claude (child) — step-02-go-no-go
  ...
  claude (child) — step-06 ralph-wiggum iteration 1
  claude (child) — step-06 ralph-wiggum iteration 2
  ...
  claude (child) — merge-worktree (background, post-workflow)
```

Each spawned `claude` process is a direct child of the engine process. Steps execute sequentially within a wave.

## TypeScript Config

- Target: ES2022, module: ESNext, bundler resolution
- Strict mode with `noUncheckedIndexedAccess`
- Node >= 20 required

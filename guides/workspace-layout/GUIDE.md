# Workspace Layout

## Visao geral

Um workspace eh a unidade de trabalho do agentic-workflow. Ele contem tudo necessario para construir um produto autonomamente: uma referencia ao projeto, o repositorio sendo construido e o estado de cada wave de execucao.

O workspace em si eh um repositorio git. Isso permite versionar o estado do harness independentemente do produto sendo construido.

## Estrutura

```
{workspace}/
├── .git/                           ← git do workspace (estado do harness)
├── workspace.json                  ← referencia ao projeto + config
│
├── repo/                           ← repositorio do produto (submodule git)
│   ├── .git/
│   ├── sprints/
│   │   ├── sprint-1/
│   │   │   ├── 1-brainstorming/
│   │   │   ├── 2-specs/
│   │   │   ├── 3-prps/
│   │   │   └── features.json
│   │   └── sprint-2/
│   │       └── ...
│   ├── apps/
│   ├── packages/
│   ├── CLAUDE.md
│   ├── package.json
│   └── ...                         ← codigo do produto
│
├── wave-1/                         ← primeira execucao do workflow
│   ├── worktree/                   ← git worktree de repo/ (isolamento)
│   │   └── ...                     ← mesma estrutura de repo/
│   ├── step-01-pain-gain-analysis/
│   │   ├── spawn.json              ← meta do spawn (pid, start, end, exit)
│   │   └── spawn.jsonl             ← transcript do claude
│   ├── step-02-go-no-go/
│   │   ├── spawn.json
│   │   └── spawn.jsonl
│   ├── step-03-derive-specs/
│   │   ├── spawn.json
│   │   └── spawn.jsonl
│   ├── step-04-derive-prps/
│   │   ├── spawn.json
│   │   └── spawn.jsonl
│   ├── step-05-plan-features/
│   │   ├── spawn.json
│   │   └── spawn.jsonl
│   ├── step-06-ralph-wiggum-loop/
│   │   ├── F-001-attempt-1/
│   │   │   ├── spawn.json
│   │   │   └── spawn.jsonl
│   │   ├── F-001-attempt-2/        ← retry apos gutter detection
│   │   │   ├── spawn.json
│   │   │   └── spawn.jsonl
│   │   ├── F-002-attempt-1/
│   │   │   ├── spawn.json
│   │   │   └── spawn.jsonl
│   │   └── loop.json               ← estado consolidado do loop
│   ├── step-07-wave-limit/
│   │   ├── spawn.json
│   │   └── spawn.jsonl
│   └── merge/
│       ├── spawn.json
│       └── spawn.jsonl
│
├── wave-2/
│   └── ...
│
└── wave-3/
    └── ...
```

## Conceitos

### workspace.json

O workspace nao contem uma copia do projeto — contem uma **referencia**. O `workspace.json` aponta para um projeto em `context/projects/{slug}/`:

```json
{
  "project": "arc",
  "workflow": "vibe-app",
  "repo": "git@github.com:org/arc.git",
  "created_at": "2026-03-05T10:00:00Z"
}
```

O engine resolve `{project}` para o path do projeto referenciado (ex: `context/projects/arc/artifacts/`), usando o `target_folder` do `project.json`. Isso garante:

- **Source of truth unica** — o projeto vive em `context/projects/`, o workspace so aponta
- **Workspace leve** — sem duplicacao de arquivos de briefing
- **Atualizacao automatica** — mudancas no projeto (via ARC ou manual) sao visíveis imediatamente pelo workspace

### repo/

O repositorio do produto sendo construido. Pode ser:

- **Clone de um git existente** — se `repo` esta definido no project.json
- **Init local** — se o projeto nao tem repositorio preexistente

O repo acumula o resultado de todas as waves. Eh o deliverable final — o que o usuario recebe.

#### sprints/

Artefatos do processo de desenvolvimento que pertencem ao produto. Cada sprint corresponde a uma wave que produziu material entregavel.

O numero do sprint eh independente do numero da wave — nem toda wave gera um sprint.

Conteudo tipico de um sprint:

- `1-brainstorming/` — analise de dores e ganhos, value map
- `2-specs/` — especificacoes tecnicas derivadas do brainstorming
- `3-prps/` — PRPs (Product Requirement Prompts) derivados das specs
- `features.json` — backlog de features com status pass/fail

A numeracao das pastas (1-, 2-, 3-) torna a progressao visivel.

### wave-{n}/

Estado de uma execucao do workflow. Pertence ao harness, nao ao produto.

Cada wave contem:

- **worktree/** — git worktree de repo/, onde o agente trabalha. Isolamento real — se a wave falhar, o repo nao eh afetado.
- **step-{nn}-{task}/** — pasta por step do workflow, contendo spawn.json e spawn.jsonl

O prefixo numerico (step-01, step-02) preserva a ordem de execucao. Cada step eh uma pasta isolada para seus arquivos.

#### ralph-wiggum-loop

Dentro do step do loop, cada feature/attempt eh uma pasta flat:

- `F-001-attempt-1/` — primeiro spawn da feature F-001
- `F-001-attempt-2/` — retry apos gutter detection
- `F-002-attempt-1/` — primeiro spawn da feature F-002

Isso preserva o historico completo de tentativas. O `loop.json` consolida o estado geral do loop.

#### merge/

O merge nao eh um step do workflow — eh executado pelo engine apos o workflow terminar. Por isso nao tem prefixo numerico.

### Dois gits, duas responsabilidades

| Git | Dono | Comita quando | Conteudo |
|-----|------|---------------|----------|
| workspace (.git/) | harness | a qualquer momento | estado das waves, workspace.json |
| repo (.git/) | produto | ao final de wave bem-sucedida (merge) | codigo, sprints, docs |

O workspace pode comitar estado a qualquer momento sem afetar o produto. O repo so recebe commits via merge de worktree apos conclusao bem-sucedida de uma wave.

## Lifecycle de uma wave

```
1. Engine le workspace.json → resolve projeto em context/projects/{slug}/
2. Engine cria wave-{n}/ e wave-{n}/worktree/ (git worktree de repo/)
3. Engine cria sprints/sprint-{n}/ dentro da worktree
4. Workflow executa steps sequencialmente
   - Cada step cria step-{nn}-{task}/ em wave-{n}/
   - spawn.json + spawn.jsonl registram cada invocacao do claude
   - Artefatos do processo vao para worktree/sprints/sprint-{n}/
   - Codigo vai para worktree/apps/, worktree/packages/, etc.
5. Workflow termina
6. Engine spawna merge agent em background (worktree → repo)
7. Se chain-workflow: engine cria wave-{n+1}/ em paralelo com merge
```

## Registro de spawn (spawn.json)

```json
{
  "task": "pain-gain-analysis",
  "agent": "researcher",
  "wave": 1,
  "step": 1,
  "parent_pid": 12340,
  "pid": 12345,
  "started_at": "2026-03-05T10:00:00Z",
  "finished_at": "2026-03-05T10:12:30Z",
  "exit_code": 0,
  "timed_out": false
}
```

Para spawns do ralph-wiggum loop, inclui tambem:

```json
{
  "task": "vibe-code",
  "agent": "coder",
  "wave": 1,
  "step": 6,
  "feature": "F-001",
  "attempt": 2,
  "parent_pid": 12340,
  "pid": 12367,
  "started_at": "2026-03-05T11:30:00Z",
  "finished_at": "2026-03-05T11:45:00Z",
  "exit_code": 1,
  "timed_out": false
}
```

## Arvore de processos

```
agentic-workflow (engine)                     PID principal
│
├── wave-1: vibe-app
│   ├── spawn: pain-gain-analysis             claude (sequencial)
│   ├── spawn: go-no-go                       claude (sequencial)
│   ├── spawn: derive-specs                   claude (sequencial)
│   ├── spawn: derive-prps                    claude (sequencial)
│   ├── spawn: plan-features                  claude (sequencial)
│   ├── ralph-wiggum-loop
│   │   ├── spawn: vibe-code (F-001)          claude (sequencial)
│   │   ├── spawn: vibe-code (F-002)          claude (sequencial)
│   │   └── ...
│   ├── spawn: wave-limit                     claude (sequencial)
│   └── spawn: merge                          claude (background)
│
├── wave-2: vibe-app                          inicia em paralelo com merge da wave-1
│   └── ...
```

Cada spawn eh sequencial dentro da wave (exceto merge). O engine spawna um claude por vez, espera terminar, spawna o proximo.

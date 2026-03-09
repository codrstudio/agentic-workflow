# S-004 — Listagem de Projetos e Workflows

**Discoveries:** D-004 (score 8)

## Objetivo

Expor projetos e workflows disponíveis via API para que o frontend apresente combos de seleção, eliminando a necessidade de memorizar slugs.

## Escopo

### Backend (apps/hub)

- Ler `context/projects/*/project.json` para listar projetos
- Ler `context/workflows/*.yaml` para listar workflows
- Expor via REST

### Frontend (apps/web)

- Página `/projects` com lista de projetos (cards)
- Cada card mostra: nome, slug, status, descrição
- Card é clicável → navega para `/projects/:slug`

## API Endpoints

### `GET /api/v1/projects`

**Response 200:**
```json
[
  {
    "name": "Agentic Workflow Monitor",
    "slug": "aw-monitor",
    "description": "Projeto de construção do monitoramento",
    "status": "brainstorming",
    "created_at": "2026-03-09"
  }
]
```

### `GET /api/v1/projects/:slug`

**Response 200:** Retorna project.json completo + dados do workspace (se existir).

```json
{
  "name": "Agentic Workflow Monitor",
  "slug": "aw-monitor",
  "description": "...",
  "status": "brainstorming",
  "created_at": "2026-03-09",
  "repo": { "url": "...", "source_branch": "main", "target_branch": "..." },
  "workspace": {
    "exists": true,
    "waves": [
      { "number": 1, "status": "running", "steps_total": 6, "steps_completed": 1 }
    ]
  }
}
```

### `GET /api/v1/workflows`

**Response 200:**
```json
[
  {
    "slug": "vibe-app",
    "name": "Vibe App",
    "steps_count": 6
  }
]
```

## Lógica de Leitura

O hub lê do filesystem a partir de paths relativos à raiz do monorepo:
- Projetos: `context/projects/*/project.json`
- Workflows: `context/workflows/*.yaml`
- Workspaces: `context/workspaces/*/workspace.json`

A raiz do monorepo é derivada de `process.cwd()` ou variável `AW_ROOT`.

## Critérios de Aceite

1. `GET /api/v1/projects` lista todos os projetos com campos corretos
2. `GET /api/v1/projects/:slug` retorna detalhes do projeto com info do workspace
3. `GET /api/v1/workflows` lista todos os workflows disponíveis
4. Página `/projects` renderiza cards com informações do projeto
5. Card clicável navega para detalhe do projeto
6. Projetos sem workspace mostram status adequado

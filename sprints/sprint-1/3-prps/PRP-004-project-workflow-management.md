# PRP-004 — Gestão de Projetos e Workflows

**Specs:** S-004, S-005
**Prioridade:** 4
**Dependências:** PRP-001, PRP-003

## Objetivo

Expor projetos e workflows via API REST e implementar a execução de workflows via UI. O operador deve poder listar projetos, selecionar workflow e disparar execução sem memorizar slugs.

## Escopo

### Backend — Listagem (apps/hub)

- `GET /api/v1/projects` — lista projetos lendo `context/projects/*/project.json`
- `GET /api/v1/projects/:slug` — detalhe do projeto com info do workspace
- `GET /api/v1/workflows` — lista workflows lendo `context/workflows/*.yaml`
- Raiz do monorepo derivada de `AW_ROOT` ou `process.cwd()`

### Backend — Execução (apps/hub)

- `POST /api/v1/projects/:slug/runs` — spawna CLI da engine como child process
- `GET /api/v1/projects/:slug/runs` — lista execuções ativas/recentes
- `DELETE /api/v1/projects/:slug/runs/:runId` — SIGTERM ao processo
- Estado em memória (Map de `Run`)
- Monitora evento `exit` do child process para atualizar status

### Frontend

- Página `/projects` com cards de projeto (nome, slug, status)
- Página `/projects/:slug` com detalhe do projeto
- Formulário de execução: select de workflow + input opcional de plano + botão "Executar"
- Lista de execuções ativas com PID, status, botão parar

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-011 | Projects & Workflows API | Endpoints `GET /projects`, `GET /projects/:slug`, `GET /workflows`. Leitura do filesystem para listar projetos e workflows disponíveis. |
| F-012 | Projects List Page | Página `/projects` com cards clicáveis. Cada card mostra nome, slug, status. Navegação para detalhe. |
| F-013 | Project Execution API | Endpoints `POST /projects/:slug/runs`, `GET .../runs`, `DELETE .../runs/:runId`. Spawn do CLI da engine. Tracking de PID e status em memória. |
| F-014 | Project Detail + Execution UI | Página `/projects/:slug` com info do projeto, formulário de execução (select workflow, input plano, botão executar), lista de runs ativas com status e botão parar. |

## Limites

- NÃO implementa persistência de runs (em memória apenas — perdem-se ao reiniciar hub)
- NÃO implementa visualização de waves/steps (PRP-006)
- NÃO implementa SSE para atualização de status de runs (PRP-005)

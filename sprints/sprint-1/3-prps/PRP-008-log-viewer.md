# PRP-008 — Log Viewer

**Specs:** S-009
**Prioridade:** 8
**Dependências:** PRP-006

## Objetivo

Visualizar o conteúdo de spawn.jsonl de um step específico, com parsing das mensagens do Claude CLI e highlight por tipo. Permite debugging detalhado de cada agent spawn.

## Escopo

### Backend (apps/hub)

- `GET /api/v1/projects/:slug/waves/:waveNumber/steps/:stepIndex` — metadados do step (spawn.json)
- `GET /api/v1/projects/:slug/waves/:waveNumber/steps/:stepIndex/log` — linhas parseadas com paginação (`offset`, `limit`)
- Parsing de spawn.jsonl: classifica cada linha JSON por tipo (system, assistant, tool_use, tool_result, user)

### Frontend (apps/web)

- Página `/projects/:slug/waves/:waveNumber/steps/:stepIndex`:
  - StepDetail header: task, agent, timing, exit code, badge success/failure
  - LogViewer: lista virtualizada (react-window ou similar)
  - Cada mensagem com ícone/cor por tipo:
    - assistant → azul, tool_use → roxo, tool_result → cinza, system → amarelo, user → verde
  - Botão "Ir para o fim"
  - Busca textual dentro do log (client-side filter)

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-023 | Step Detail & Log API | Endpoints `GET .../steps/:stepIndex` (metadata do spawn.json) e `GET .../steps/:stepIndex/log` (linhas parseadas com paginação offset/limit). Parser de spawn.jsonl por tipo de mensagem. |
| F-024 | Log Viewer UI | Página de detalhe do step com header de metadata. LogViewer virtualizado para performance com 1000+ linhas. Highlight por tipo de mensagem. Botão scroll-to-bottom. Busca textual. Layout responsivo com scroll horizontal para conteúdo largo. |

## Limites

- NÃO implementa streaming de logs em tempo real (log é lido por paginação)
- NÃO implementa export/download de logs
- NÃO implementa diff entre tentativas de uma feature

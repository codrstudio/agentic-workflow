# PRP-009 — Feed de Eventos & Agent Actions

**Specs:** S-010, S-011
**Prioridade:** 9
**Dependências:** PRP-005, PRP-003

## Objetivo

Exibir um feed em tempo real de todos os EngineEvents recebidos via SSE, com filtros por tipo e projeto. Exibir lista de agent actions reportadas pelo `AgentActionReporter` com status de lifecycle. Ambos consomem dados já disponíveis via PRP-005.

## Escopo

### Backend (apps/hub)

- `GET /api/v1/projects/:slug/agent-actions` — lista actions armazenadas em memória (já recebidas via PRP-005 F-016)
- Nenhum endpoint novo para feed de eventos (consome `useSSE()` direto)

### Frontend — Event Feed

- Página `/events`:
  - Lista de eventos em ordem cronológica reversa
  - Cada evento: timestamp (relativo + absoluto no hover), tipo (badge colorido), dados resumidos
  - Auto-scroll com toggle para pausar
  - Limite de 500 eventos em memória (ring buffer do useSSE)
- EventFilters:
  - Filtro por tipo (multi-select checkboxes)
  - Filtro por projeto (select)
  - Busca textual
  - Filtros persistem na URL (query params)
- Badges por categoria: workflow → azul, feature → verde, agent → roxo, loop → laranja, gutter → vermelho, queue → amarelo

### Frontend — Agent Actions

- Seção na página `/projects/:slug`:
  - Tabela/lista compacta de actions
  - Colunas: status (badge), task, agent, feature, duração, preview
  - Action running com indicador animado
  - Click expande preview do output
  - Ordenação por data (mais recente primeiro)

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-025 | Event Feed Page | Página `/events` com feed de EngineEvents em tempo real via useSSE. Lista cronológica reversa. Badges de tipo coloridos por categoria. Auto-scroll com toggle pause. Limite 500 eventos. Animação framer-motion em novos eventos. |
| F-026 | Event Filters | Filtros para a página `/events`: multi-select por tipo de evento, select por projeto, busca textual. Persistência de filtros em query params da URL. |
| F-027 | Agent Actions List | Endpoint `GET /projects/:slug/agent-actions`. Componente AgentActionsList na página do projeto com tabela de actions, badges de status, duração, preview expansível. Indicador animado para actions em andamento. |

## Limites

- NÃO implementa persistência de eventos (ring buffer em memória)
- NÃO implementa export de eventos
- NÃO implementa histórico de agent actions entre reinícios do hub

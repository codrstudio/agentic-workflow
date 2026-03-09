# S-010 — Feed de Eventos SSE ao Vivo

**Discoveries:** D-010 (score 7)

## Objetivo

Exibir um feed em tempo real de todos os EngineEvents recebidos via SSE, com filtros por tipo e por projeto. Complementa o monitoramento de wave (S-007) com visibilidade granular de cada evento.

## Escopo

### Frontend (apps/web)

- Página `/events` com feed de eventos
- Sem backend adicional — consome dados do hook `useSSE()` (S-006)

## Componentes Frontend

### EventFeed

- Lista de eventos em ordem cronológica reversa (mais recente no topo)
- Cada evento mostra:
  - Timestamp (relativo + absoluto no hover)
  - Tipo do evento (badge colorido)
  - Dados resumidos (extraídos de `event.data`)
- Auto-scroll para novos eventos (com toggle para pausar)
- Limite de eventos em memória (últimos 500)

### EventFilters

- Filtro por tipo de evento (multi-select com checkboxes)
- Filtro por projeto (select)
- Busca textual no conteúdo dos eventos
- Filtros persistem na URL (query params)

### Badges de Tipo

Cores por categoria:
- `workflow:*` → azul
- `feature:*` → verde
- `agent:*` → roxo
- `loop:*` → laranja
- `gutter:*` → vermelho
- `queue:*` → amarelo

## Critérios de Aceite

1. Página `/events` exibe feed de eventos em tempo real
2. Novos eventos aparecem no topo com animação (framer-motion)
3. Filtro por tipo funciona com múltipla seleção
4. Filtro por projeto funciona
5. Busca textual filtra eventos
6. Auto-scroll pode ser pausado/retomado
7. Performance estável com 500 eventos no feed
8. Funciona em mobile

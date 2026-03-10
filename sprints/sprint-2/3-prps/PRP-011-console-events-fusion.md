# PRP-011 — Console + Events Fusion

**Specs:** S-015, S-016
**Prioridade:** 2 (requisito explícito do TASK.md, maior impacto na UX)
**Dependências:** nenhuma

## Objetivo

Unificar as páginas `/console` e `/events` em uma única página `/console` que exibe operator queue messages e EngineEvents interleaved cronologicamente em modelo chat. Após a fusão, remover a rota `/events` (com redirect) e limpar sidebar/bottom-nav. Inspirado no CLI `aw:console`.

## Escopo

### Frontend (apps/web)

- Reescrever `pages/console.tsx` para fundir conteúdo de `pages/events.tsx`
- Feed unificado cronológico com dois tipos de entrada: operator messages (direita) e engine events (esquerda)
- Filtros por tipo/categoria, projeto e busca textual (incorporados do events.tsx)
- Campo de envio de mensagem mantido
- Remoção de `pages/events.tsx`, redirect `/events → /console`
- Limpeza de sidebar e bottom-nav

### Backend

- Sem alterações. Frontend já consome ambos os fluxos (REST para messages, SSE para events).

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-031 | Console Unified Feed | Reescrever `pages/console.tsx` com tipo `FeedItem` (operator-message \| engine-event). Merge de operator messages (API REST) e engine events (useSSE) em feed cronológico. Operator messages alinhadas à direita com badge de status. Engine events à esquerda com badge de categoria colorido (reutilizar `CATEGORY_COLORS`, `getCategory()`, `getLabel()`, `getSummary()` de events.tsx). Campo de envio de mensagem no bottom. Select de projeto filtra ambos os fluxos. |
| F-032 | Console Filters | Painel de filtros colapsável: checkboxes por categoria de evento (workflow, feature, agent, loop, gutter, queue) + checkbox para operator messages. Select de projeto. Busca textual por conteúdo. Filtros persistem na URL via query params. |
| F-033 | Events Route Removal & Cleanup | Remover `pages/events.tsx`. Alterar router: substituir `eventsRoute` por redirect `/events → /console`. Remover item "Eventos" de `NAV_ITEMS` em `app-shell.tsx`. Limpar bottom-nav. Sidebar fica com: Projetos + Console. Verificar que build compila sem referências órfãs. |

## Limites

- NÃO implementa scroll inteligente (PRP-012)
- NÃO altera look & feel visual além do necessário para a fusão (PRP-013)
- Ring buffer de 500 engine events em memória (mantido do events.tsx)
- Operator messages carregadas via REST (todas do projeto selecionado)

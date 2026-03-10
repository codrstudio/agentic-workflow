# S-015 — Console + Events Fusion

**Discoveries:** D-016 (score 9)

## Objetivo

Unificar as páginas `/console` e `/events` em uma única página `/console` que exibe operator queue messages e EngineEvents interleaved cronologicamente, em modelo chat. Inspirado no CLI `aw:console` que mostra mensagens da queue e eventos SSE no mesmo fluxo.

## Escopo

### Frontend (apps/web)

- Reescrever `pages/console.tsx` para fundir o conteúdo de `pages/events.tsx`
- Exibir dois tipos de entrada em um único feed cronológico:
  1. **Operator messages** — mensagens enviadas pelo operador via queue (vindas da API `/messages`)
  2. **Engine events** — EngineEvents recebidos via SSE (todos os tipos: engine:event, run:*, agent:action:*, operator:message:*)
- Manter funcionalidades de envio de mensagem do console atual
- Incorporar filtros do events atual (tipo, projeto, busca textual)

### Backend

- Sem alterações no backend. O frontend já consome ambos os fluxos:
  - API REST `GET /api/v1/projects/:slug/messages` para mensagens da queue
  - Hook `useSSE()` para eventos em tempo real

## Modelo de Dados do Feed Unificado

```typescript
type FeedItemType = 'operator-message' | 'engine-event'

interface FeedItem {
  id: string
  type: FeedItemType
  timestamp: number  // ms epoch para ordenação
  // Para operator-message:
  message?: HubMessage
  // Para engine-event:
  event?: FeedEvent
}
```

### Ordenação

- Feed em ordem cronológica (mais antigo no topo, mais recente no bottom) — modelo chat
- Autoscroll para o bottom quando novas entradas chegam (comportamento de S-017)
- Operator messages usam `timestamp` do `HubMessage`
- Engine events usam `timestamp` do `SSEEvent`

## Layout da Página

```
┌─────────────────────────────────────┐
│ Projeto: [select ▼]    [Filtros ▼]  │
├─────────────────────────────────────┤
│                                     │
│  [engine-event] workflow:start      │
│  aw-monitor · vibe-app              │
│                         10:30:00    │
│                                     │
│  [operator] Olá, boa tarde          │
│  status: queued                     │
│                         10:31:00    │
│                                     │
│  [engine-event] queue:processing    │
│  aw-monitor                         │
│                         10:31:05    │
│                                     │
│  [engine-event] queue:done          │
│  aw-monitor                         │
│                         10:31:30    │
│                                     │
├─────────────────────────────────────┤
│ [Mensagem para a engine...]  [Enviar]│
└─────────────────────────────────────┘
```

### Diferenciação visual por tipo

- **Operator messages**: alinhadas à direita (como mensagem do usuário em chat), com badge de status (queued/processing/done)
- **Engine events**: alinhadas à esquerda, com badge de categoria colorido (workflow=azul, feature=verde, agent=roxo, loop=laranja, gutter=vermelho, queue=amarelo) — reutilizar `CATEGORY_COLORS` e `getCategory()` do events.tsx atual

### Componentes a reutilizar do events.tsx

- `getCategory()` — classificação de eventos por categoria
- `getLabel()` — label legível do evento
- `getSummary()` — resumo do conteúdo
- `CATEGORY_COLORS` — cores por categoria
- `getEventSlug()` — extrai slug do evento para filtro por projeto
- Filtros (tipo, projeto, busca textual) — incorporar como painel colapsável

### Componentes a reutilizar do console.tsx

- `StatusBadge` — badge de status da mensagem
- Lógica de envio de mensagens (POST + SSE update)
- Select de projeto

## Filtros

Painel de filtros colapsável no topo (mesmo design do events.tsx atual):

- **Tipo de entrada**: checkboxes para categorias (workflow, feature, agent, loop, gutter, queue) + checkbox para "operator messages"
- **Projeto**: select dropdown (filtra tanto events por slug quanto messages por projeto selecionado)
- **Busca textual**: filtra por conteúdo do label/summary/message
- Filtros persistem na URL via query params

## Limites

- Ring buffer de últimos 500 engine events em memória (como events.tsx atual)
- Operator messages carregadas via REST (todas as do projeto selecionado)

## Critérios de Aceite

1. Página `/console` exibe operator messages e engine events em um único feed cronológico
2. Operator messages aparecem alinhadas à direita com badge de status
3. Engine events aparecem alinhados à esquerda com badge de categoria colorido
4. Campo de envio de mensagem funciona como antes (Enter para enviar, POST para API)
5. Status de mensagens atualiza via SSE (queued → processing → done)
6. Filtros por tipo/categoria, projeto e busca textual funcionam
7. Novas entradas aparecem no bottom com autoscroll (quando no bottom)
8. Select de projeto filtra tanto messages quanto events
9. Funciona em mobile com layout responsivo
10. Performance estável com 500 events + N messages no feed

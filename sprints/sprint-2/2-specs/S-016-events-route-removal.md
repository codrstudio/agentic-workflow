# S-016 — Remoção da Rota /events e Redirect

**Discoveries:** D-019 (score 7)

**Depende de:** S-015 (Console + Events fusion)

## Objetivo

Após a fusão Console+Events (S-015), a página `/events` torna-se obsoleta. Remover a rota, a página e o item de sidebar, mantendo um redirect `/events → /console` para URLs salvas em bookmarks.

## Escopo

### Frontend (apps/web)

- Remover `pages/events.tsx` (código já incorporado em `pages/console.tsx` por S-015)
- Alterar `router/index.tsx`: remover `eventsRoute` e substituir por redirect
- Alterar `components/layout/app-shell.tsx`: remover item "Eventos" do `NAV_ITEMS`
- Alterar `components/layout/bottom-nav.tsx`: remover "Eventos" dos itens de navegação (se presente)

## Alterações

### `apps/web/src/router/index.tsx`

1. Remover import de `EventsPage`
2. Substituir `eventsRoute` por redirect:
   ```typescript
   const eventsRoute = createRoute({
     getParentRoute: () => authRoute,
     path: "/events",
     beforeLoad: () => {
       throw redirect({ to: "/console" })
     },
   })
   ```
3. Manter a rota no `routeTree` para que o redirect funcione

### `apps/web/src/components/layout/app-shell.tsx`

Remover o item `{ to: "/events", label: "Eventos", icon: Activity }` do array `NAV_ITEMS`. O sidebar ficará com:

```typescript
const NAV_ITEMS = [
  { to: "/projects", label: "Projetos", icon: FolderKanban },
  { to: "/console", label: "Console", icon: Terminal },
] as const
```

### `apps/web/src/components/layout/bottom-nav.tsx`

Remover "Eventos" dos itens de navegação mobile (se referenciado). Ajustar o número de slots (de 3 itens para 2 + menu).

### Arquivo `pages/events.tsx`

Deletar o arquivo. Todo o código útil (helpers de categorias, cores, formatação) já foi movido para `pages/console.tsx` por S-015.

## Critérios de Aceite

1. Acessar `/web/events` redireciona automaticamente para `/web/console`
2. Sidebar exibe apenas "Projetos" e "Console" (sem "Eventos")
3. BottomNav mobile não exibe "Eventos"
4. Arquivo `pages/events.tsx` não existe mais
5. Build compila sem erros (`npm run typecheck`)
6. Nenhuma referência órfã a `EventsPage` no codebase

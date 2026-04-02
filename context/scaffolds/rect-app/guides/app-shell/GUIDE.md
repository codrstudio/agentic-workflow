# App Shell

O App Shell eh o sistema de layout, navegacao e responsividade do scaffold. Ele encapsula toda a experiencia autenticada: sidebar, breadcrumbs, shortcuts mobile, notificacoes, busca e menu de usuario.

## Conceito

O shell segue o principio **mobile-first com experiencia web otimizada**. Nao eh um layout mobile esticado para desktop — sao duas experiencias distintas, planejadas e implementadas:

- **Mobile (< 768px)**: shortcut bar fixa no bottom, drawer bottom (Vaul) para menu completo, titulo simples no header, busca expansivel, notificacoes em drawer.
- **Desktop (>= 768px)**: sidebar fixa colapsavel, breadcrumbs completos, busca sempre visivel, notificacoes em popover.

A transicao eh automatica via `useIsMobile()` (breakpoint 768px). Nao existe estado intermediario.

## Anatomia

```
Desktop                                     Mobile
┌──────────┬──────────────────────────┐     ┌─────────────────────────┐
│ Sidebar  │ BreadcrumbBar            │     │ BreadcrumbBar           │
│ 240/64px │ [≡] Home / Page  [🔍🔔] │     │ [←] Titulo    [🔍] [🔔]│
│          ├──────────────────────────┤     ├─────────────────────────┤
│  Brand   │                          │     │                         │
│  Menu    │   <main>                 │     │   <main>                │
│  Widgets │     <Outlet />           │     │     <Outlet />          │
│  Avatar  │                          │     │                         │
│          │                          │     ├─────────────────────────┤
└──────────┴──────────────────────────┘     │ ShortcutBar  [≡ Menu]  │
                                            └─────────────────────────┘
```

O container raiz eh `flex min-h-svh bg-background`. O conteudo principal usa `margin-left` animado que acompanha a largura da sidebar (240px expandida, 64px colapsada, 0 no mobile).

## Componentes

Todos vivem em `packages/ui/src/components/`:

| Componente | Caminho | Papel |
|---|---|---|
| **AppShell** | `app-shell/app-shell.tsx` | Orquestrador — monta sidebar, drawer, breadcrumb, shortcut bar, editor |
| **Sidebar** | `app-shell/sidebar.tsx` | Container fixo lateral, desktop only, `hidden md:flex` |
| **BreadcrumbBar** | `app-shell/breadcrumb-bar.tsx` | Header sticky `h-14` com breadcrumbs, busca e notificacoes |
| **ShortcutBar** | `app-shell/shortcut-bar.tsx` | Barra de atalhos fixa no bottom, mobile only, `md:hidden` |
| **ShortcutEditor** | `app-shell/shortcut-editor.tsx` | Drawer para editar atalhos (mobile only) |
| **AppNavPanel** | `app-nav-panel/app-nav-panel.tsx` | Painel de navegacao com 5 areas — reusado em Sidebar e Drawer |
| **AppNavBrand** | `app-nav-panel/app-nav-brand.tsx` | Logo responsivo ao estado colapsado |
| **AppNavWidgets** | `app-nav-panel/app-nav-widgets.tsx` | Cards de status com tooltip quando colapsado |
| **AvatarMenu** | `app-nav-panel/avatar-menu.tsx` | Avatar + Popover com perfil, tema e logout |
| **AppMenu** | `app-menu/app-menu.tsx` | Menu hierarquico com drill-down via context stack |
| **AppMenuItem** | `app-menu/app-menu-item.tsx` | Item individual — link ou drill-down, com tooltip quando colapsado |
| **NotificationPanel** | `notifications/notification-panel.tsx` | Popover (desktop) / Drawer (mobile) de notificacoes |

## Fluxo de dados

O `AppShell` eh **headless quanto a estado** — nao faz fetch, nao gerencia rotas, nao armazena estado global. Tudo vem por props da rota `_shell.tsx`:

```
_shell.tsx (route layout)
  ├── menuRoot          ← config/menu.ts (arvore de navegacao)
  ├── activeRoute       ← router.state.location.pathname
  ├── breadcrumbs       ← construido a partir de useMatches() + staticData.breadcrumb
  ├── pageTitle         ← ultimo breadcrumb
  ├── shortcuts/available/isFull ← useShortcuts(menuRoot)
  ├── theme             ← useTheme()
  ├── user              ← dados do usuario autenticado
  ├── notifications     ← dados de notificacoes
  ├── menuOpen          ← search param ?menu=true (estado roteavel)
  ├── canGoBack         ← breadcrumbs.length > 1
  └── callbacks         ← router.navigate, setTheme, add/remove/reorder, etc
        │
        ▼
    <AppShell ...props>
      <Outlet />
    </AppShell>
```

O estado do drawer mobile (`menuOpen`) vive como search param (`?menu=true`) — isso garante que o estado sobrevive a F5 e que o botao voltar do browser fecha o drawer.

**Por que props e nao contexto?** Porque o shell eh um componente de `packages/ui` — ele nao conhece TanStack Router, nao conhece o backend, nao conhece a estrutura de rotas. A integracao acontece exclusivamente na rota `_shell.tsx` do app.

## Detalhes por subsistema

- [Sidebar](sidebar.md) — container lateral desktop, colapse, dimensoes
- [BreadcrumbBar](breadcrumb-bar.md) — header responsivo, busca, notificacoes
- [ShortcutBar](shortcut-bar.md) — atalhos mobile, editor, persistencia
- [Menu](menu.md) — arvore hierarquica, drill-down, tipos, AppNavPanel
- [Styling](styling.md) — tokens CSS, temas, espacamento, component-first

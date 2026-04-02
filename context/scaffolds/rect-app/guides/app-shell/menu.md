# Menu

Sistema de navegacao hierarquico com drill-down, composto por `<AppMenu />`, `<AppNavPanel />` e tipos compartilhados.

> **Principio DRY**: o menu eh definido uma vez por app (`config/menu.ts`) e consumido
> pelo `<AppNavPanel />`, que vive na Sidebar (desktop) e no Drawer bottom (mobile).
> Mesma definicao, mesma renderizacao, mesmos itens.

---

## Modelo de dados

Definido em `packages/ui/src/components/app-menu/types.ts`:

```typescript
type Tier = "customer" | "attendant" | "manager" | "admin"

interface MenuItem {
  id: string              // "home", "settings"
  label: string           // "Inicio", "Configuracoes"
  icon: ComponentType<{ className?: string }>  // Phosphor icon
  route?: string          // rota de navegacao (leaf node)
  children?: MenuContext  // se tem filhos, eh um no de drill-down
  minTier?: Tier          // tier minimo para ver este item
}

interface MenuGroup {
  id: string              // "main", "settings"
  label: string           // label do grupo (pode ser vazio)
  items: MenuItem[]
}

interface MenuContext {
  id: string              // "root", "automations"
  title?: string          // titulo exibido no topo do contexto
  parent?: string         // id do contexto pai
  groups: MenuGroup[]
  defaultShortcuts?: string[]  // IDs dos atalhos padrao (mobile)
}

interface MenuWidget {
  id: string
  icon: ComponentType<{ className?: string }>
  label: string
  value?: string
  onClick?: () => void
}
```

---

## Definicao por app

Cada app define sua arvore em `apps/{app}/config/menu.ts`:

```typescript
export const menuRoot: MenuContext = {
  id: "root",
  groups: [
    {
      id: "main",
      items: [
        { id: "home", label: "Inicio", icon: House, route: "/" },
      ],
    },
    {
      id: "settings",
      label: "Configuracoes",
      items: [
        { id: "settings", label: "Configuracoes", icon: Gear, route: "/settings" },
      ],
    },
  ],
  defaultShortcuts: ["home", "settings"],
}
```

---

## AppNavPanel: as 5 areas

O `<AppNavPanel />` (`app-nav-panel/app-nav-panel.tsx`) compoe as 5 areas de navegacao. Eh o **mesmo componente** na Sidebar desktop e no Drawer mobile:

```
┌──────────────────────────────────┐
│  [brand]         [editar atalhos]│  ← Brand + link mobile-only
│──────────────────────────────────│  ← Separator
│  [menu]                          │  ← <AppMenu /> scrollavel (flex-1)
│──────────────────────────────────│  ← Separator (se tem widgets)
│  [widgets]                       │  ← Status cards opcionais
│──────────────────────────────────│  ← Separator
│  [avatar menu]                   │  ← Trigger do popover de usuario
└──────────────────────────────────┘
```

### 1. Brand (`AppNavBrand`)

Logo responsivo ao estado de colapse:

| Contexto | Renderiza |
|----------|-----------|
| Expandido / Drawer | `logo` (ReactNode passado por prop) |
| Colapsado | `logoCollapsed` (ReactNode, fallback para `logo`) |

Altura fixa: `h-14`. Centralizado quando colapsado (`justify-center`).

### 2. Menu (`AppMenu`)

Area scrollavel (`overflow-y-auto`, `flex-1`) com grupos e itens. Detalhes abaixo.

### 3. Widgets (`AppNavWidgets`)

Cards de status opcionais:

| Estado | Renderizacao |
|--------|-------------|
| Expandido | icon + label + value, hover com `bg-sidebar-accent` |
| Colapsado | icon + value, com `<Tooltip>` side="right" |

### 4. Avatar Menu (`AvatarMenu`)

Trigger: avatar + nome + role (expandido) ou avatar only + tooltip (colapsado).

Popover (`w-64`) com:
1. **Mini hero**: avatar grande + nome + role + email (clicavel → perfil)
2. **Tema**: toggle tri-state — Claro / Escuro / Auto (`<Button variant="secondary">` para ativo)
3. **Sair**: `text-destructive` com `hover:bg-destructive/10`

Posicao do popover: `side="top"` quando expandido, `side="right" align="end"` quando colapsado.

### 5. "Editar atalhos" (mobile only)

Link `text-primary text-xs` ao lado do brand, passado via `onEditShortcuts` prop. Nao aparece no desktop.

---

## AppMenu: drill-down hierarquico

O `<AppMenu />` (`app-menu/app-menu.tsx`) renderiza o contexto atual de um **context stack**:

```typescript
const [contextStack, setContextStack] = useState<MenuContext[]>([root])
const current = contextStack[contextStack.length - 1]
```

### Navegacao em profundidade

Quando um `MenuItem` tem `children` (em vez de `route`), clicar nele faz push do contexto filho no stack:

```
NIVEL 0: RAIZ                        NIVEL 1: CONTEXTO FILHO
┌───────────────────────────┐        ┌───────────────────────────┐
│  GRUPO A                  │        │  ← Voltar                │
│    Item 1          →     │   →    │                           │
│    Item 2                │        │  SUBGRUPO                 │
│                          │        │    Sub-item 1             │
│  GRUPO B                 │        │    Sub-item 2             │
│    Item 3                │        │    Sub-item 3             │
└───────────────────────────┘        └───────────────────────────┘
```

- O `→` (CaretRight) indica drill-down disponivel.
- "Voltar" faz pop do stack (`contextStack.slice(0, -1)`).
- "Voltar" nao aparece quando colapsado.
- O titulo do contexto aparece como header (`text-xs font-semibold uppercase`).

### AppMenuItem

Cada item (`app-menu/app-menu-item.tsx`):

- `min-h-[44px]` — respeita touch target minimo
- `active:scale-[0.98]` — feedback tactil
- Ativo: `bg-sidebar-accent font-medium text-sidebar-accent-foreground`
- Colapsado: `justify-center px-0` + `<Tooltip side="right">`
- Drill-down: `<CaretRight className="ml-auto opacity-50" />`

---

## Filtragem por tier

Cada `MenuItem` pode ter `minTier` opcional. A hierarquia de tiers:

```
customer < attendant < manager < admin
```

Itens cujo `minTier` excede o do usuario devem ser filtrados antes de passar para o menu.

---

## Arquitetura de componentes

```
packages/ui/src/components/
  app-nav-panel/
    app-nav-panel.tsx       ← compoe as 5 areas
    app-nav-brand.tsx       ← logo responsivo
    app-nav-widgets.tsx     ← slot de widgets com tooltip
    avatar-menu.tsx         ← trigger + popover (perfil, tema, logout)
  app-menu/
    app-menu.tsx            ← renderiza context stack + grupos + itens
    app-menu-item.tsx       ← item individual (link ou drill-down)
    types.ts                ← MenuItem, MenuGroup, MenuContext, MenuWidget, Tier

apps/{app}/
  config/
    menu.ts                 ← arvore de menu do app
```

---

## Veja tambem

- [Sidebar](sidebar.md) — host desktop do AppNavPanel
- [ShortcutBar](shortcut-bar.md) — host mobile + barra de atalhos
- [BreadcrumbBar](breadcrumb-bar.md) — header com breadcrumbs

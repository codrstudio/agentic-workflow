# BreadcrumbBar

Header sticky no topo do conteudo com navegacao hierarquica, busca e notificacoes. Presente em ambas as plataformas com adaptacao responsiva completa.

---

## Implementacao

O componente `BreadcrumbBar` (`app-shell/breadcrumb-bar.tsx`) eh um `<header>` com:

- `sticky top-0 z-10` — fixa no topo durante scroll
- `h-14` — altura fixa de 56px
- `border-b border-border bg-background` — separador visual
- Tres areas: esquerda (navegacao), centro (breadcrumbs/titulo), direita (busca + notificacoes)

---

## Anatomia por plataforma

### Desktop (>= 768px)

```
┌──────────────────────────────────────────────────────────────────┐
│  [≡]  │  Home / Gestao / Automacoes  │  [🔍 Buscar...]    [🔔]  │
└──────────────────────────────────────────────────────────────────┘
   │              │                          │               │
   sidebar     breadcrumb path           searchbox       notificacoes
   toggle      (cada nivel clicavel)     (w-48, h-8)     (popover)
```

| Area | Componente | Comportamento |
|------|-----------|---------------|
| Esquerda | `<Button variant="ghost" size="icon">` com `<List />` | Toggle collapse da sidebar |
| Centro | `<nav>` com breadcrumbs separados por `/` | Niveis intermediarios sao links clicaveis, ultimo eh texto bold |
| Direita | `<Input>` + `<NotificationPanel>` | Busca sempre visivel (w-48), notificacoes em popover |

### Mobile (< 768px) — estado normal

```
┌──────────────────────────────────────────────┐
│  [←]   Onboarding                 [🔍] [🔔]  │
└──────────────────────────────────────────────┘
   │        │                        │     │
   voltar   titulo                 search  notif
                                   icone   (drawer)
```

| Area | Componente | Comportamento |
|------|-----------|---------------|
| Esquerda | `<Button>` com `<CaretLeft />` (size-11, 44x44 touch) | Navega para rota pai (nao `history.back()`) |
| Centro | `<span>` com `pageTitle` | Titulo truncado da pagina atual |
| Direita | `<Button>` com `<MagnifyingGlass />` + `<NotificationPanel>` | Busca expansivel, notificacoes em drawer |

### Mobile — busca ativa

```
┌──────────────────────────────────────────────┐
│  [←]   [       Buscar...            ]  [🔔]  │
└──────────────────────────────────────────────┘
   │              │                        │
   fecha       searchbox expandido      notif
   busca       (substitui titulo)
```

Quando a busca esta ativa, o `<CaretLeft />` fecha a busca em vez de navegar para tras.

---

## Busca

### Desktop
- Campo `<Input>` sempre visivel, largura fixa `w-48`, altura `h-8`.
- Submit via Enter.

### Mobile
- Icone de lupa que ao clicar ativa `searchActive` state.
- O `<Input>` substitui o titulo com `autoFocus`.
- O botao voltar alterna entre "fechar busca" e "navegar para tras".
- Notificacoes permanecem visiveis durante a busca.

---

## Botao voltar (mobile)

- Aparece **somente quando `canGoBack` eh true** (breadcrumbs.length > 1).
- Navega para a **rota pai** na hierarquia, nao `history.back()`.
  Ex: `/settings/profile` → `/settings`.
- Construido na `_shell.tsx`: `breadcrumbs[breadcrumbs.length - 2].route`.
- Area de toque: `size-11` (44x44px) — respeita minimo touch target.
- Visual: `<CaretLeft />` sem borda, sem fundo (`variant="ghost"`).

---

## Notificacoes

O `<NotificationPanel>` renderiza de forma diferente por plataforma:

| Plataforma | Container | Trigger |
|------------|-----------|---------|
| Desktop | `<Popover>` com `w-80` | `<Button variant="ghost" size="icon">` com `<Bell />` |
| Mobile | `<Drawer>` bottom (Vaul) | Mesmo botao, `size-11` |

Badge de contagem: `<span>` posicionado `absolute right-1 top-1` com `bg-destructive`, mostra ate "9+".

Conteudo do painel:
- Lista de notificacoes com `timeAgo` relativo
- Nao-lidas com `bg-accent/50` e icone `<BellRinging weight="fill" />`
- Botao "Ver todas as notificacoes" no footer
- Estado vazio com icone e mensagem

---

## Breadcrumbs (construcao)

Os breadcrumbs sao construidos na `_shell.tsx` a partir de `useMatches()`:

```typescript
const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
  const items = [{ label: "Home", route: "/" }]
  for (const match of matches) {
    const label = (match.staticData as { breadcrumb?: string })?.breadcrumb
    if (label) items.push({ label, route: match.pathname })
  }
  return items
}, [matches])
```

Cada rota define seu breadcrumb via `staticData`:

```typescript
export const Route = createFileRoute("/_shell/settings")({
  staticData: { breadcrumb: "Configuracoes" },
})
```

---

## Veja tambem

- [Sidebar](sidebar.md) — controlada pelo botao collapse da breadcrumb bar
- [ShortcutBar](shortcut-bar.md) — barra mobile complementar
- [Menu](menu.md) — navegacao principal

# ShortcutBar

Barra fixa na base do mobile com atalhos rapidos personalizaveis e acesso ao menu completo.

> **Escopo**: somente mobile (`md:hidden`). No desktop a navegacao vive na Sidebar.

---

## Anatomia

```
┌─────────────────────────────────────────────────────┐
│  [Inicio]  [Config]  [...]   [...]   [...]  │ Menu │
│   🏠        ⚙️                               │  ≡   │
└─────────────────────────────────────────────────────┘
 ◄──── ate 5 slots personalizaveis ────────────►  fixo
```

- **5 slots**: preenchidos com `MenuItem` do menu, personalizaveis pelo usuario.
- **Menu**: fixo na extrema direita, separado por `border-l`. Abre o Drawer bottom (Vaul).
- **Highlight**: slot correspondente a `activeRoute` recebe `text-primary`.
- Cada slot: `min-h-[56px]`, icone + label truncado (`text-[10px]`).
- `padding-bottom: env(safe-area-inset-bottom)` — respeita safe area do iPhone.

---

## Drawer mobile (Menu)

Ao tocar em "Menu", o `AppShell` abre um `<Drawer>` (Vaul) com o **mesmo `<AppNavPanel />`** da Sidebar desktop — as 5 areas completas:

```
┌────────────────────────────────────────┐
│ ░  ── handle ──                      ░ │
│ ░                                    ░ │
│ ░  Scaffold          Editar atalhos  ░ │  ← brand + link exclusivo mobile
│ ░────────────────────────────────────░ │
│ ░                                    ░ │
│ ░  Inicio                            ░ │
│ ░  Configuracoes                     ░ │  ← <AppMenu /> (mesmo do desktop)
│ ░                                    ░ │
│ ░────────────────────────────────────░ │
│ ░  /\ Joao Silva                     ░ │  ← avatar menu
│ ░  \/ Administrador                  ░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└────────────────────────────────────────┘
```

O `<AppNavPanel />` recebe `collapsed={false}` no drawer — nunca eh colapsado no mobile.

O link "Editar atalhos" (`onEditShortcuts`) aparece apenas no mobile: eh passado como prop ao `<AppNavPanel />` e renderizado ao lado do brand.

Ao navegar por um item do menu no drawer, o drawer fecha automaticamente (`closeDrawerIfMobile`).

---

## Estado do Drawer como search param

O estado aberto/fechado do drawer eh um search param (`?menu=true`):

```typescript
const { menu: menuOpen } = Route.useSearch()

const handleMenuOpenChange = (open: boolean) => {
  router.navigate({
    search: (prev) => ({ ...prev, menu: open || undefined }),
    replace: true,
  })
}
```

Isso garante que:
- F5 preserva o estado do drawer.
- Botao voltar do browser fecha o drawer.
- O estado eh compartilhavel via URL.

---

## ShortcutEditor

Drawer nested (Vaul) para personalizar os 5 slots. Abre a partir do link "Editar atalhos" no drawer do menu.

```
┌─────────────────────────────────────────┐
│ ░  ── handle ──                       ░ │
│ ░                                     ░ │
│ ░  Editar atalhos             Pronto  ░ │
│ ░                                     ░ │
│ ░  Seus atalhos (max. 5)              ░ │
│ ░  ┌─────────────────────────────────┐░ │
│ ░  │ ▲▼  🏠 Inicio              ✕  │░ │
│ ░  │ ▲▼  ⚙️ Configuracoes       ✕  │░ │
│ ░  └─────────────────────────────────┘░ │
│ ░                                     ░ │
│ ░  Adicionar                          ░ │
│ ░  ┌─────────────────────────────────┐░ │
│ ░  │ +  (itens disponiveis)         │░ │
│ ░  └─────────────────────────────────┘░ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└─────────────────────────────────────────┘
```

- **Secao "Seus atalhos"**: lista atual com setas cima/baixo para reordenar e botao X para remover.
- **Secao "Adicionar"**: itens do menu que tem `route` e nao estao nos atalhos. Desabilitado quando `isFull` (5 slots).
- O drawer do menu fecha antes do editor abrir (delay de 200ms para evitar conflito visual).

---

## useShortcuts hook

Hook que gerencia o estado dos atalhos (`packages/ui/src/hooks/use-shortcuts.ts`):

```typescript
useShortcuts(menuRoot: MenuContext, userId?: string)
// Retorna: { shortcuts, available, ids, add, remove, reorder, reset, isFull }
```

- **Persistencia**: `localStorage` (key: `shortcuts` ou `shortcuts:{userId}`).
- **Defaults**: `menuRoot.defaultShortcuts` — array de IDs definidos no `config/menu.ts`.
- **Max**: 5 slots (`MAX_SHORTCUTS`).
- **available**: todos os `MenuItem` com `route` que nao estao nos atalhos atuais.
- **add/remove/reorder**: operacoes imutaveis no array de IDs, sincronizadas com localStorage via `useEffect`.

---

## Veja tambem

- [Sidebar](sidebar.md) — equivalente desktop (mesmo AppNavPanel)
- [Menu](menu.md) — arvore de navegacao e AppNavPanel
- [BreadcrumbBar](breadcrumb-bar.md) — header complementar

# Sidebar

Container lateral fixo do desktop que hospeda o `<AppNavPanel />`.

> **Escopo**: somente desktop (`hidden md:flex`). No mobile a sidebar nao existe.
> O mesmo `<AppNavPanel />` vive dentro de um Drawer bottom (Vaul), acionado
> pelo botao "Menu" da ShortcutBar.

---

## Implementacao

O componente `Sidebar` (`app-shell/sidebar.tsx`) eh um `<aside>` minimal:

- `fixed inset-y-0 left-0 z-30` — posicao fixa, altura total da viewport
- `bg-sidebar` — cor semantica do sidebar
- `transition-[width] duration-200 ease-in-out` — animacao suave no colapse
- Largura via `style={{ width: collapsed ? 64 : 240 }}`

O conteudo eh inteiramente delegado ao `<AppNavPanel />` recebido como children.

---

## Dimensoes

| Estado | Largura | Logo | Menu | Widgets | Avatar |
|--------|---------|------|------|---------|--------|
| Expandida | 240px | `logo` (ReactNode) | icon + label | icon + label + value | avatar + nome + role |
| Colapsada | 64px | `logoCollapsed` (ReactNode) | icon only + tooltip | icon + value + tooltip | avatar only + tooltip |

---

## Colapse

O estado de colapse eh gerenciado pelo hook `useSidebarState()`:

- Persiste em `localStorage` (key: `sidebar:collapsed`)
- Expoe `collapsed: boolean` e `toggle: () => void`
- O trigger fica na BreadcrumbBar (botao hamburger `<List />`)
- O conteudo principal usa `margin-left` sincronizado com a largura

O `<AppNavPanel />` recebe `collapsed={!isMobile && collapsed}` — no mobile/drawer, nunca eh colapsado.

---

## Sidebar vs Drawer mobile

O `<AppNavPanel />` eh o **mesmo componente** nos dois containers. As diferencas sao apenas do container:

| Aspecto | Sidebar (desktop) | Drawer (mobile) |
|---------|-------------------|-----------------|
| Container | `<aside>` fixo lateral | `<Drawer>` bottom (Vaul) |
| Colapse | Sim (64px, icon only) | N/A (abre/fecha) |
| "Editar atalhos" | Nao aparece | Link ao lado do brand |
| Brand | Responsivo ao `collapsed` | Sempre expandido |
| Trigger de abertura | Sempre visivel | Botao "Menu" na ShortcutBar |

---

## Veja tambem

- [Menu](menu.md) — `<AppMenu />` e `<AppNavPanel />` (as 5 areas)
- [ShortcutBar](shortcut-bar.md) — barra mobile + trigger do drawer
- [BreadcrumbBar](breadcrumb-bar.md) — controla o collapse da sidebar

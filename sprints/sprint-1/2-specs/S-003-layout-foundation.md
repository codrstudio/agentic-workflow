# S-003 — Layout Foundation

**Discoveries:** D-003 (score 9), D-014 (score 5)

## Objetivo

Criar o AppShell com sidebar shadcn retrátil, BottomNav mobile, menu do usuário e theme switch. Este é o esqueleto de navegação do app — sem ele nenhuma página pode ser renderizada.

## Escopo

### Roteamento

- TanStack Router com rotas:
  - `/login` — página de login (sem layout)
  - `/` — redirect para `/projects`
  - `/projects` — listagem de projetos
  - `/projects/:slug` — detalhe do projeto
  - `/projects/:slug/waves/:waveNumber` — detalhe da wave
  - `/projects/:slug/waves/:waveNumber/steps/:stepIndex` — detalhe do step
  - `/console` — console do operador
  - `/events` — feed de eventos SSE

### AppShell

- Layout wrapper que renderiza sidebar + conteúdo
- Sidebar shadcn v4 retrátil (colapsável para ícones)
- Sem topbar (TASK.md proíbe)
- Conteúdo ocupa 100% da largura disponível

### Sidebar

Items de navegação:
1. **Projetos** — ícone FolderKanban, rota `/projects`
2. **Console** — ícone Terminal, rota `/console`
3. **Eventos** — ícone Activity, rota `/events`

Base do sidebar:
- Avatar + username (do auth context)
- Theme switch: claro / escuro / auto (default auto)
- Botão "Sair"

### BottomNav (mobile)

- Visível apenas em viewport < 768px
- Até 4 atalhos dos items do sidebar + botão menu
- Menu abre drawer (vaul) com todos os items + "Customizar"
- Página "Customizar" permite selecionar quais 4 atalhos aparecem
- Sincroniza com mudanças no sidebar

### Theme Switch

- Toggle entre light / dark / system
- Persistência em localStorage
- Integra com ThemeProvider existente em `apps/web/src/components/theme-provider.tsx`

## Dependências Frontend

- `@tanstack/react-router` — Roteamento
- Sidebar components do shadcn/ui (a ser instalado via CLI ou manual)
- `vaul` — Drawers mobile
- `framer-motion` — Transições de página
- `lucide-react` — Ícones

## Critérios de Aceite

1. Sidebar renderiza com items de navegação e é colapsável
2. Sidebar colapsado mostra apenas ícones
3. Menu do usuário na base do sidebar com avatar, username, theme switch e "Sair"
4. Theme switch alterna entre light/dark/system e persiste no localStorage
5. BottomNav aparece em viewports < 768px com até 4 atalhos
6. BottomNav menu abre drawer com todos os items
7. Navegação funciona entre todas as rotas definidas
8. Layout não tem topbar
9. Transições de página com framer-motion

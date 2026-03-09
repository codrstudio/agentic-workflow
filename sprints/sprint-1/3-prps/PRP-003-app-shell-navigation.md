# PRP-003 — App Shell & Navegação

**Specs:** S-003, S-012
**Prioridade:** 3
**Dependências:** PRP-002

## Objetivo

Criar o esqueleto de navegação do app: AppShell com sidebar shadcn retrátil, BottomNav mobile, theme switch, roteamento TanStack Router, breadcrumb drill-down e navegação linkada. Sem este PRP, nenhuma página de negócio pode ser renderizada.

## Escopo

### Roteamento (TanStack Router)

- `/login` — sem layout (PRP-002)
- `/` → redirect `/projects`
- `/projects` — listagem
- `/projects/:slug` — detalhe do projeto
- `/projects/:slug/waves/:waveNumber` — detalhe da wave
- `/projects/:slug/waves/:waveNumber/steps/:stepIndex` — detalhe do step
- `/console` — console do operador
- `/events` — feed de eventos

### AppShell

- Layout wrapper: sidebar + conteúdo
- Sem topbar (TASK.md proíbe)
- Conteúdo 100% da largura disponível

### Sidebar (shadcn)

- Retrátil (colapsa para ícones)
- Items: Projetos (FolderKanban), Console (Terminal), Eventos (Activity)
- Base: avatar + username (auth context), theme switch, botão "Sair"

### BottomNav (mobile < 768px)

- Até 4 atalhos do sidebar + botão menu
- Menu abre drawer (vaul) com todos os items + "Customizar"
- Página "Customizar" para selecionar atalhos

### Theme Switch

- Toggle light/dark/system
- Persistência localStorage
- Integra com ThemeProvider existente

### Breadcrumb + Drill-down

- Breadcrumb em todas as páginas exceto `/projects`
- Desktop: horizontal completo
- Mobile: último nível + "..." abre drawer com níveis anteriores
- Componente LinkableText para referências F-XXX e step-XX

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-006 | TanStack Router Setup | Instalar e configurar TanStack Router. Definir todas as rotas (stubs vazios). Route guard que redireciona para `/login` se não autenticado. |
| F-007 | AppShell + Sidebar | Componente AppShell com sidebar shadcn retrátil. Items de navegação com ícones. Layout sem topbar. |
| F-008 | Sidebar User Menu + Theme Switch | Menu do usuário na base do sidebar: avatar, username, theme toggle (light/dark/system com persistência), botão "Sair". |
| F-009 | BottomNav Mobile | BottomNav visível em viewport < 768px. Atalhos configuráveis. Drawer com menu completo + página "Customizar". |
| F-010 | Breadcrumb + Navegação Linkada | Componente Breadcrumb reutilizável. Colapso mobile com drawer. Componente LinkableText para F-XXX / step-XX. Transições framer-motion entre páginas. |

## Limites

- NÃO implementa conteúdo das páginas (apenas stubs/placeholders)
- NÃO implementa chamadas a APIs de negócio
- NÃO implementa animações complexas além de transições de página básicas

# Brainstorming — Sprint 1 — AW Monitor

---

## Contexto

O TASK.md define a criação de um **webapp responsivo de monitoramento do Agentic Workflow harness**. O sistema permite:

1. **Executar projetos** — disparar a engine com parâmetros (projeto, workflow, plano) via interface, sem precisar memorizar slugs.
2. **Interagir com a engine** — enviar mensagens para o `OperatorQueue` e acompanhar respostas via SSE.
3. **Monitorar o sistema** — visualização de status dos projetos, waves, steps, features, processos ativos.
4. **Receber eventos SSE da engine** — a engine já emite eventos `EngineEvent` via `Notifier`/`SSEAdapter`. O hub precisa consumir esses eventos e repassá-los ao frontend.

**Stack definida:** Vite + shadcn/ui + SSE (frontend), Node.js + Hono + SSE (backend).

**Design:** Mobile-first, sem topbar, sidebar retrátil (shadcn Sidebar), sem tabs horizontais (usar alternativas), vaul para drawers/popups, framer-motion para transições, autenticação via SYSUSER/SYSPASS/SYSROLE.

---

## Funcionalidades mapeadas (código existente)

### Engine (`apps/engine/src/`)

| Componente | O que provê |
|---|---|
| `AgentActionReporter` | Endpoints REST: `POST /api/v1/hub/projects/:slug/agent-actions` e `PATCH .../agent-actions/:id` — registra lifecycle de spawns |
| `SSEAdapter` | Handler HTTP para `/events` — broadcast de `EngineEvent` para clientes SSE conectados |
| `Notifier` | EventEmitter interno — emite `engine:event` com `EngineEvent` tipado |
| `OperatorQueue` | Fila JSONL `operator-queue.jsonl` — enqueue/drain de mensagens do operador para o agente |
| `status.ts` | CLI que lê workspace, wave, steps, spawn.json, loop.json, spawn.jsonl e exibe estado ao vivo |
| `console.ts` | CLI interativo que enfileira mensagens e monitora drain |
| `EngineEventSchema` | 23 tipos de evento tipados (workflow:start, feature:pass, agent:spawn, queue:received...) |
| `WorkflowSchema` | 6 tipos de step: spawn-agent, spawn-agent-call, ralph-wiggum-loop, chain-workflow, spawn-workflow, stop-on-wave-limit |

### Web (`apps/web/src/`)

- `App.tsx` — scaffold vazio ("Project ready!")
- `ThemeProvider` — dark/light mode
- Nenhuma rota, nenhuma página, nenhum backend implementado

---

## Lacunas e oportunidades

### 1. Backend (Hono server) — ausente

A engine já tem `AgentActionReporter` que faz `POST/PATCH` para `AW_HUB_URL`. O hub (servidor Hono) precisa existir para:
- Receber esses eventos e armazená-los em memória/arquivo
- Expor SSE para o frontend (`/sse`)
- Expor endpoints REST para o frontend (projetos, runs, ações do operador)
- Executar a engine via `spawn` (equivalente ao `aw:run`)

### 2. Autenticação

TASK.md exige autenticação via SYSUSER/SYSPASS/SYSROLE. Nenhum mecanismo existe ainda. Necessário implementar login simples + proteção de rotas.

### 3. Listagem/seleção de projetos e workflows

A engine lê `context/projects/{slug}/project.json` e `context/workflows/{slug}.yaml`. O hub deve expor esses slugs para o frontend, evitando digitação manual.

### 4. Execução de projeto via UI

Equivalente ao `aw:run -- <project> <workflow> [--plan <plan>]`. O hub precisa spawnar `node apps/engine/dist/cli.js` com os parâmetros corretos, capturar PID e status.

### 5. Console do operador via UI

Equivalente ao `aw:console`. O frontend deve permitir enviar mensagens que são enfileiradas no `operator-queue.jsonl` via hub. O hub deve mostrar mensagens pendentes/processadas via SSE.

### 6. Monitoramento via UI

Equivalente ao `aw:status`. O hub deve ler o workspace e expor estado via REST + SSE. O frontend exibe: wave ativa, steps, status de cada step, loop state, feature progress, activity recente.

### 7. Integração de eventos SSE da engine

`SSEAdapter` já existe mas é um handler HTTP. O hub deve instanciar `SSEAdapter` + `Notifier` e conectar ao processo da engine para repassar eventos ao frontend.

### 8. Navegação linkada ("monitoramento navegável")

TASK.md exige que a informação exibida sirva como navegação: clicar num projeto vai para detalhes, clicar num step abre o spawn.jsonl, clicar numa feature abre os logs de tentativas.

### 9. Sidebar robusto e retrátil

TASK.md proíbe topbar. Sidebar shadcn v4 retrátil deve ser o canivete suiço de navegação. Base do sidebar: menu do usuário com avatar, switch de tema claro/escuro/auto, Sair.

### 10. BottomNav mobile

CLAUDE.md descreve o componente BottomNav (até 4 atalhos + menu). Necessário para experiência mobile.

### 11. Gaps de especificação vs código

- `AgentActionReporter` chama endpoints REST do hub (`POST/PATCH agent-actions`) mas o hub não existe — gap crítico.
- `SSEAdapter` existe mas não está conectado a nenhum servidor HTTP real — gap crítico.
- `console.ts` usa readline (terminal) — o equivalente web precisa de uma abordagem diferente (formulário + SSE).
- `status.ts` usa `readdir`/`readFile` direto no filesystem — o hub precisa replicar essa lógica via API.

---

## Priorização

### Ranking por impacto e ordem lógica de implementação

| # | Discovery | Score | Justificativa |
|---|---|---|---|
| D-001 | Backend Hono server scaffolding | 10 | Base de tudo. Sem o servidor nenhum outro item funciona. |
| D-002 | Autenticação SYSUSER/SYSPASS | 9 | Requisito de segurança explícito. Bloqueia acesso a todas as features. |
| D-003 | Layout Foundation (AppShell + Sidebar + BottomNav) | 9 | Sem layout, nenhuma página pode ser renderizada. Bloqueia todas as features de UI. |
| D-004 | Listagem de projetos e workflows (combos) | 8 | Prerequisito para execução de projeto. Evita memorização de slugs. |
| D-005 | Execução de projeto via UI (spawn engine) | 8 | Core feature #1 do TASK.md. Alto impacto operacional. |
| D-006 | Status/monitoramento de wave ativa (REST polling-free) | 8 | Core feature #3. Provê visibilidade imediata do sistema. |
| D-007 | SSE da engine → frontend (integração SSEAdapter) | 8 | Core feature #4. Habilita realtime sem polling. Prerequisito para D-008 e D-010. |
| D-008 | Log viewer de spawn.jsonl (step detail) | 7 | Parte do monitoramento navegável. Debugging de agents. |
| D-009 | Console do operador via UI (OperatorQueue web) | 7 | Core feature #2. Permite interação com a engine sem terminal. |
| D-010 | Feed de eventos SSE ao vivo (stream de EngineEvents) | 7 | Visibilidade granular de tudo que a engine emite. |
| D-011 | Gestão de status de AgentActions (received/pending/done) | 6 | Tracking de lifecycle dos spawns. Útil para auditoria. |
| D-012 | Navegação linkada (drill-down projeto→wave→step→feature) | 6 | Regra de ouro do TASK.md. Exige rotas e componentes de detalhe. |
| D-013 | Feature loop progress (ralph-wiggum dashboard) | 6 | Visibilidade do loop de features com pass/fail/skip. |
| D-014 | Theme switch claro/escuro/auto no sidebar | 5 | Parte do sidebar. UX quality-of-life. |
| D-015 | PWA / offline awareness | 4 | Nice-to-have. TASK.md não exige explicitamente, mas o stack suporta. |

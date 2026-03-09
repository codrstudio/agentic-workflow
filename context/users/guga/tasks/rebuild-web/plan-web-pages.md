---
agent: general
description: Inventaria páginas de referência e gera features.json com todas as páginas para migrar
---

# Plan Web Pages

Leia o roteador de referência, identifique todas as páginas a implementar, e gere `features.json` com escopo detalhado.

## Inputs

1. Leia `{reference_dir}/router.tsx` — extrai todas as rotas e páginas importadas
2. Leia `{web_dir}/routes/` — identifique o que já existe
3. Leia `{reference_dir}/pages/` — lista de arquivos de página disponíveis

## Output

Produza dois artefatos:

### 1. `{sprint}/features.json`

```json
[
  {
    "id": "F-001",
    "name": "Layout de Projeto com Tabs",
    "description": "Cria o layout base ($projectId) com roteamento file-based, ProjectNav com abas, integração com AppSidebar dinâmico. Base para todos os subpages.",
    "status": "pending",
    "priority": 1,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": [],
    "tests": [
      "Rota /web/projects/$projectId existe e renderiza ProjectLayout",
      "Componente ProjectNav exibe abas (sources, chat, artifacts, pipeline, reviews, metrics, settings, etc)",
      "Sidebar AppSidebar renderiza corretamente (desktop e mobile)",
      "Build sem erros (npx vite build)"
    ],
    "prp_path": null,
    "page_file": "N/A (layout, não é uma página)"
  },
  {
    "id": "F-002",
    "name": "Página de Projetos (Overview)",
    "description": "Migra projects.tsx → /web/projects/overview (já parcialmente feito). Renderiza lista responsiva de projetos com cards.",
    "status": "pending",
    "priority": 2,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": [],
    "tests": [
      "Rota /web/projects/overview renderiza corretamente",
      "Lista de projetos exibe em grid responsivo (mobile 1 col, tablet 2, desktop 3+)",
      "Cards mostram nome, descrição, status",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "projects.tsx"
  },
  {
    "id": "F-003",
    "name": "Página de Sources",
    "description": "Migra project-sources.tsx → /web/projects/$projectId/sources. Exibe lista de sources com opções de adicionar/editar.",
    "status": "pending",
    "priority": 3,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/sources renderiza",
      "Lista de sources em tabela responsiva ou cards",
      "Botão 'Add Source' abre Dialog/Sheet (mobile)",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "project-sources.tsx"
  },
  {
    "id": "F-004",
    "name": "Página de Chat",
    "description": "Migra project-chat.tsx → /web/projects/$projectId/chat. Chat interface com lista de sessões e área de conversa.",
    "status": "pending",
    "priority": 4,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/chat renderiza",
      "Lista de sessões exibe corretamente",
      "Componente de input de mensagem presente",
      "Responsivo (sidebar colapsável em mobile)",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "project-chat.tsx"
  },
  {
    "id": "F-005",
    "name": "Página de Sessão de Chat (Sub-rota)",
    "description": "Migra chat-session.tsx → /web/projects/$projectId/chat/$sessionId. Visualização de uma sessão de chat específica.",
    "status": "pending",
    "priority": 5,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-004"],
    "tests": [
      "Rota /web/projects/$projectId/chat/$sessionId renderiza",
      "Histórico de mensagens exibe corretamente",
      "Input de mensagem funcional",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "chat-session.tsx"
  },
  {
    "id": "F-006",
    "name": "Página de Artifacts",
    "description": "Migra project-artifacts.tsx → /web/projects/$projectId/artifacts. Lista de artifacts com tabs para ACRs, etc.",
    "status": "pending",
    "priority": 6,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/artifacts renderiza",
      "Tabs para diferentes tipos de artifacts",
      "Lista de artifacts exibe corretamente",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "project-artifacts.tsx"
  },
  {
    "id": "F-007",
    "name": "Página de ACR List",
    "description": "Migra acr-list.tsx → /web/projects/$projectId/artifacts/acrs. Lista de ACRs com filtros.",
    "status": "pending",
    "priority": 7,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-006"],
    "tests": [
      "Rota /web/projects/$projectId/artifacts/acrs renderiza",
      "Tabela de ACRs com colunas: ID, Status, Data, Ações",
      "Filtros/search funcional",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "acr-list.tsx"
  },
  {
    "id": "F-008",
    "name": "Página de ACR Detail",
    "description": "Migra acr-detail.tsx → /web/projects/$projectId/artifacts/acrs/$acrId. Visualização detalhada de um ACR.",
    "status": "pending",
    "priority": 8,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-007"],
    "tests": [
      "Rota /web/projects/$projectId/artifacts/acrs/$acrId renderiza",
      "Detalhes do ACR exibem corretamente",
      "Ações disponíveis (edit, delete, etc)",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "acr-detail.tsx"
  },
  {
    "id": "F-009",
    "name": "Página de Pipeline",
    "description": "Migra project-pipeline.tsx → /web/projects/$projectId/pipeline. Visualização de pipeline com DAG de execução.",
    "status": "pending",
    "priority": 9,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/pipeline renderiza",
      "DAG/timeline de pipeline exibe corretamente",
      "Responsivo (horizontal scroll em mobile se necessário)",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "project-pipeline.tsx"
  },
  {
    "id": "F-010",
    "name": "Página de Pipeline Health",
    "description": "Migra pipeline-health-dashboard.tsx → /web/projects/$projectId/pipeline/health. Dashboard de saúde do pipeline.",
    "status": "pending",
    "priority": 10,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-009"],
    "tests": [
      "Rota /web/projects/$projectId/pipeline/health renderiza",
      "Métricas de saúde (uptime, latência, erros) exibem",
      "Gráficos responsivos",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "pipeline-health-dashboard.tsx"
  },
  {
    "id": "F-011",
    "name": "Página de Reviews",
    "description": "Migra project-reviews.tsx → /web/projects/$projectId/reviews. Lista de reviews/approvals.",
    "status": "pending",
    "priority": 11,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/reviews renderiza",
      "Lista de reviews com status (pending, approved, rejected)",
      "Botões de ação responsivos",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "project-reviews.tsx"
  },
  {
    "id": "F-012",
    "name": "Página de Review Panel",
    "description": "Migra review-panel.tsx → /web/projects/$projectId/reviews/$reviewId. Visualização detalhada de uma review.",
    "status": "pending",
    "priority": 12,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-011"],
    "tests": [
      "Rota /web/projects/$projectId/reviews/$reviewId renderiza",
      "Detalhes da review (checklist, comentários) exibem",
      "Ações (approve, reject, request-changes) disponíveis",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "review-panel.tsx"
  },
  {
    "id": "F-013",
    "name": "Página de Metrics (Hub)",
    "description": "Migra project-metrics.tsx → /web/projects/$projectId/metrics. Hub de métricas com tabs para diferentes tipos.",
    "status": "pending",
    "priority": 13,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/metrics renderiza",
      "Tabs: Cost, Cognitive Debt, Quality, Throughput, ROI",
      "Cada tab carrega corretamente",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "project-metrics.tsx"
  },
  {
    "id": "F-014",
    "name": "Página de Cost Dashboard",
    "description": "Migra cost-dashboard.tsx → /web/projects/$projectId/metrics/cost. Dashboard de custos.",
    "status": "pending",
    "priority": 14,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-013"],
    "tests": [
      "Rota /web/projects/$projectId/metrics/cost renderiza",
      "Gráficos de custo por dia/semana/mês",
      "Breakdown por agente/operação",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "cost-dashboard.tsx"
  },
  {
    "id": "F-015",
    "name": "Página de Cognitive Debt Dashboard",
    "description": "Migra cognitive-debt-dashboard.tsx → /web/projects/$projectId/metrics/cognitive-debt. Dashboard de dívida cognitiva.",
    "status": "pending",
    "priority": 15,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-013"],
    "tests": [
      "Rota /web/projects/$projectId/metrics/cognitive-debt renderiza",
      "Indicadores de dívida exibem (complexidade, compreensão, etc)",
      "Gráficos responsivos",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "cognitive-debt-dashboard.tsx"
  },
  {
    "id": "F-016",
    "name": "Página de Handoff List",
    "description": "Migra handoff-list.tsx → /web/projects/$projectId/handoff. Lista de handoffs com opções.",
    "status": "pending",
    "priority": 16,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/handoff renderiza",
      "Tabela/lista de handoffs com status",
      "Botão 'New Handoff' presente",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "handoff-list.tsx"
  },
  {
    "id": "F-017",
    "name": "Página de Handoff Wizard",
    "description": "Migra handoff-wizard.tsx → /web/projects/$projectId/handoff/new. Wizard de criação de handoff.",
    "status": "pending",
    "priority": 17,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-016"],
    "tests": [
      "Rota /web/projects/$projectId/handoff/new renderiza",
      "Steps do wizard exibem (1, 2, 3, ...)",
      "Navegação entre steps funciona",
      "Form validation em cada step",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "handoff-wizard.tsx"
  },
  {
    "id": "F-018",
    "name": "Página de Board (Harness)",
    "description": "Migra agentic-board.tsx → /web/projects/$projectId/harness/board. Board visual do harness com cards de waves/sprints.",
    "status": "pending",
    "priority": 18,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/harness/board renderiza",
      "Cards de waves/sprints exibem",
      "Status visual (running, completed, failed) aparece",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "agentic-board.tsx"
  },
  {
    "id": "F-019",
    "name": "Página de Board Config",
    "description": "Migra board-config.tsx → /web/projects/$projectId/harness/board/config. Configuração do board.",
    "status": "pending",
    "priority": 19,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-018"],
    "tests": [
      "Rota /web/projects/$projectId/harness/board/config renderiza",
      "Formulário de configuração exibe",
      "Campos de config (colunas, cores, etc)",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "board-config.tsx"
  },
  {
    "id": "F-020",
    "name": "Página de Model Config",
    "description": "Migra pipeline-model-config.tsx → /web/projects/$projectId/harness/pipeline/model-config. Configuração de modelos.",
    "status": "pending",
    "priority": 20,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-009"],
    "tests": [
      "Rota /web/projects/$projectId/harness/pipeline/model-config renderiza",
      "Lista de modelos disponíveis",
      "Formulário de seleção/atribuição",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "pipeline-model-config.tsx"
  },
  {
    "id": "F-021",
    "name": "Página de Settings",
    "description": "Migra project-settings.tsx → /web/projects/$projectId/settings. Hub de configurações com tabs para diferentes aspectos.",
    "status": "pending",
    "priority": 21,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/settings renderiza",
      "Tabs: General, Quality Gates, MCP Servers, etc",
      "Cada tab carrega corretamente",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "project-settings.tsx"
  },
  {
    "id": "F-022",
    "name": "Página de Quality Gates Settings",
    "description": "Migra quality-gates-settings.tsx → /web/projects/$projectId/settings/quality-gates. Configuração de quality gates.",
    "status": "pending",
    "priority": 22,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-021"],
    "tests": [
      "Rota /web/projects/$projectId/settings/quality-gates renderiza",
      "Lista de gates com opções de add/edit/delete",
      "Cada gate tem campos de configuração",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "quality-gates-settings.tsx"
  },
  {
    "id": "F-023",
    "name": "Página de MCP Server Detail",
    "description": "Migra mcp-server-detail.tsx → /web/projects/$projectId/settings/mcp/$serverId. Visualização detalhada de servidor MCP.",
    "status": "pending",
    "priority": 23,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-021"],
    "tests": [
      "Rota /web/projects/$projectId/settings/mcp/$serverId renderiza",
      "Detalhes do servidor (nome, URL, ferramentas) exibem",
      "Ações (test, edit, delete) disponíveis",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "mcp-server-detail.tsx"
  },
  {
    "id": "F-024",
    "name": "Página de Graph Config",
    "description": "Migra graph-config.tsx → /web/projects/$projectId/sources/$sourceId/graph-config. Configuração de grafo de source.",
    "status": "pending",
    "priority": 24,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-003"],
    "tests": [
      "Rota /web/projects/$projectId/sources/$sourceId/graph-config renderiza",
      "Visualização do grafo de código",
      "Opções de zoom/pan funcionam",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "graph-config.tsx"
  },
  {
    "id": "F-025",
    "name": "Página de Containment Policies",
    "description": "Migra containment-policies.tsx → /web/projects/$projectId/containment. Configuração de políticas de contenção.",
    "status": "pending",
    "priority": 25,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/containment renderiza",
      "Lista de policies com opções de add/edit",
      "Cada policy tem regras configuráveis",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "containment-policies.tsx"
  },
  {
    "id": "F-026",
    "name": "Página de Security Dashboard",
    "description": "Migra security-dashboard.tsx → /web/projects/$projectId/security. Dashboard de segurança e auditoria.",
    "status": "pending",
    "priority": 26,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/security renderiza",
      "Events de segurança exibem em timeline/tabela",
      "Filtros por tipo de evento",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "security-dashboard.tsx"
  },
  {
    "id": "F-027",
    "name": "Página de Specs List",
    "description": "Migra spec-list.tsx → /web/projects/$projectId/specs. Lista de especificações técnicas.",
    "status": "pending",
    "priority": 27,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/specs renderiza",
      "Tabela de specs com colunas: ID, Nome, Status, Data",
      "Busca/filtro funcional",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "spec-list.tsx"
  },
  {
    "id": "F-028",
    "name": "Página de Spec Detail",
    "description": "Migra spec-detail.tsx → /web/projects/$projectId/specs/$specId. Visualização detalhada de especificação.",
    "status": "pending",
    "priority": 28,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-027"],
    "tests": [
      "Rota /web/projects/$projectId/specs/$specId renderiza",
      "Conteúdo da spec (descrição, requisitos) exibe",
      "Ações (edit, delete, export) disponíveis",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "spec-detail.tsx"
  },
  {
    "id": "F-029",
    "name": "Página de Context Profile Manager",
    "description": "Migra context-profile-manager.tsx → /web/projects/$projectId/sources/profiles. Gerenciamento de perfis de contexto.",
    "status": "pending",
    "priority": 29,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-003"],
    "tests": [
      "Rota /web/projects/$projectId/sources/profiles renderiza",
      "Lista de perfis com opções de add/edit/delete",
      "Cada perfil tem settings configuráveis",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "context-profile-manager.tsx"
  },
  {
    "id": "F-030",
    "name": "Página de Throughput Dashboard",
    "description": "Migra throughput-dashboard.tsx → /web/projects/$projectId/throughput. Dashboard de throughput/velocidade.",
    "status": "pending",
    "priority": 30,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/throughput renderiza",
      "Gráficos de throughput (features/semana, etc)",
      "Tendências (burndown chart, velocity)",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "throughput-dashboard.tsx"
  },
  {
    "id": "F-031",
    "name": "Página de ROI Dashboard",
    "description": "Migra roi-dashboard.tsx → /web/projects/$projectId/roi. Dashboard de ROI e impacto.",
    "status": "pending",
    "priority": 31,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/roi renderiza",
      "Métricas de ROI (valor gerado, tempo economizado, etc)",
      "Gráficos comparativos responsivos",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "roi-dashboard.tsx"
  },
  {
    "id": "F-032",
    "name": "Página de Rescue Wizard",
    "description": "Migra rescue-wizard.tsx → /web/projects/$projectId/rescue/$rescueId. Wizard de resgate/recuperação.",
    "status": "pending",
    "priority": 32,
    "agent": "coder",
    "task": "rebuild-web-page",
    "dependencies": ["F-001"],
    "tests": [
      "Rota /web/projects/$projectId/rescue/$rescueId renderiza",
      "Steps do wizard (diagnóstico, ação, confirmação) exibem",
      "Navegação entre steps funciona",
      "Build sem erros"
    ],
    "prp_path": null,
    "page_file": "rescue-wizard.tsx"
  }
]
```

### 2. `{sprint}/1-brainstorming/page-inventory.md`

Documente o mapeamento detalhado de rotas de referência:

# Page Inventory — rebuild-web

## Resumo

Total de páginas na referência: 32
- Layouts: 1 (ProjectLayout)
- Páginas principais: 31

## Mapeamento Detalhado

| Feature | Arquivo Referência | Rota Nova | Aba Sidebar | Status |
|---------|-------------------|-----------|------------|--------|
| F-001 | N/A | $projectId layout | ProjectNav | pending |
| F-002 | projects.tsx | /web/projects/overview | Top-level | pending |
| F-003 | project-sources.tsx | /web/projects/$projectId/sources | ProjectNav | pending |
| F-004 | project-chat.tsx | /web/projects/$projectId/chat | ProjectNav | pending |
| F-005 | chat-session.tsx | /web/projects/$projectId/chat/$sessionId | — | pending |
| F-006 | project-artifacts.tsx | /web/projects/$projectId/artifacts | ProjectNav | pending |
| F-007 | acr-list.tsx | /web/projects/$projectId/artifacts/acrs | — | pending |
| F-008 | acr-detail.tsx | /web/projects/$projectId/artifacts/acrs/$acrId | — | pending |
| F-009 | project-pipeline.tsx | /web/projects/$projectId/pipeline | ProjectNav | pending |
| F-010 | pipeline-health-dashboard.tsx | /web/projects/$projectId/pipeline/health | — | pending |
| F-011 | project-reviews.tsx | /web/projects/$projectId/reviews | ProjectNav | pending |
| F-012 | review-panel.tsx | /web/projects/$projectId/reviews/$reviewId | — | pending |
| F-013 | project-metrics.tsx | /web/projects/$projectId/metrics | ProjectNav (hub) | pending |
| F-014 | cost-dashboard.tsx | /web/projects/$projectId/metrics/cost | — | pending |
| F-015 | cognitive-debt-dashboard.tsx | /web/projects/$projectId/metrics/cognitive-debt | — | pending |
| F-016 | handoff-list.tsx | /web/projects/$projectId/handoff | ProjectNav | pending |
| F-017 | handoff-wizard.tsx | /web/projects/$projectId/handoff/new | — | pending |
| F-018 | agentic-board.tsx | /web/projects/$projectId/harness/board | ProjectNav | pending |
| F-019 | board-config.tsx | /web/projects/$projectId/harness/board/config | — | pending |
| F-020 | pipeline-model-config.tsx | /web/projects/$projectId/harness/pipeline/model-config | — | pending |
| F-021 | project-settings.tsx | /web/projects/$projectId/settings | ProjectNav | pending |
| F-022 | quality-gates-settings.tsx | /web/projects/$projectId/settings/quality-gates | — | pending |
| F-023 | mcp-server-detail.tsx | /web/projects/$projectId/settings/mcp/$serverId | — | pending |
| F-024 | graph-config.tsx | /web/projects/$projectId/sources/$sourceId/graph-config | — | pending |
| F-025 | containment-policies.tsx | /web/projects/$projectId/containment | ProjectNav | pending |
| F-026 | security-dashboard.tsx | /web/projects/$projectId/security | ProjectNav | pending |
| F-027 | spec-list.tsx | /web/projects/$projectId/specs | ProjectNav | pending |
| F-028 | spec-detail.tsx | /web/projects/$projectId/specs/$specId | — | pending |
| F-029 | context-profile-manager.tsx | /web/projects/$projectId/sources/profiles | — | pending |
| F-030 | throughput-dashboard.tsx | /web/projects/$projectId/throughput | ProjectNav | pending |
| F-031 | roi-dashboard.tsx | /web/projects/$projectId/roi | ProjectNav | pending |
| F-032 | rescue-wizard.tsx | /web/projects/$projectId/rescue/$rescueId | — | pending |

## Dependências DAG

```
F-001 (Layout de Projeto) — base para todos

├── F-002 (Projects) — independente
├── F-003 (Sources) ─┬─ F-024 (Graph Config)
│                    └─ F-029 (Context Profiles)
├── F-004 (Chat) ────── F-005 (Chat Session)
├── F-006 (Artifacts) ─┬─ F-007 (ACR List) ─── F-008 (ACR Detail)
├── F-009 (Pipeline) ──┬─ F-010 (Health)
│                       └─ F-020 (Model Config)
├── F-011 (Reviews) ─── F-012 (Review Panel)
├── F-013 (Metrics Hub)─┬─ F-014 (Cost)
│                       └─ F-015 (Cognitive Debt)
├── F-016 (Handoff) ─── F-017 (Handoff Wizard)
├── F-018 (Board) ────── F-019 (Board Config)
├── F-021 (Settings) ──┬─ F-022 (Quality Gates)
│                      └─ F-023 (MCP Detail)
├── F-025 (Containment)
├── F-026 (Security)
├── F-027 (Specs) ────── F-028 (Spec Detail)
├── F-030 (Throughput)
├── F-031 (ROI)
└── F-032 (Rescue)
```

## Notas Técnicas

- **TanStack Router**: Use file-based routing em `apps/web/src/routes/web/`
- **Layouts**: ProjectLayout como layout.tsx em $projectId
- **Components**: Migrar componentes de suporte para `apps/web/src/components/`
- **Mobile**: Dialog para modais em desktop, Sheet em mobile
- **Build**: `npx vite build` após cada feature (validar)
- **RouteTree**: Atualizado automaticamente por TanStack Router (ou gerar manualmente se necessário)

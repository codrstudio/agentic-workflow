# Derivacao do Scaffold — Guia para a IA

Este scaffold eh um ponto de partida completo com features reais e mocks demonstrativos. Ao derivar um projeto real a partir dele, **cada recurso deve ser avaliado e receber uma decisao explicita**: implementar para o dominio real, ou remover por completo.

**Regra zero: nenhum mock pode sobreviver no produto final.** Mock entregue como produto eh defeito grave. Na duvida, remova.

---

## Processo obrigatorio

Antes de comecar a implementar features do projeto, a IA deve executar este checklist de derivacao:

### Passo 1 — Inventario

Ler este guia inteiro. Conhecer cada recurso listado abaixo.

### Passo 2 — Avaliacao

Para cada recurso, decidir:
- **MANTER** — o projeto real usa este recurso. Adaptar ao dominio.
- **REMOVER** — o projeto real nao usa. Deletar codigo, rotas, componentes e referencias.
- **IMPLEMENTAR** — o recurso existe como mock. Substituir pelo real.

### Passo 3 — Execucao

Aplicar as decisoes: implementar o que precisa de implementacao, remover o que nao se aplica. Rodar os comandos geradores quando aplicavel.

### Passo 4 — Verificacao

Confirmar que:
- Nenhum mock restou (buscar por `mock`, `TODO`, `placeholder`, dados ficticios)
- Nenhum componente orfao restou (importacoes quebradas, rotas mortas)
- Os comandos geradores foram executados (`brand:derive`, `themes:build`)
- O app builda sem erros (`npm run build`, `npm run typecheck`)

---

## Catalogo de recursos

### Grupo A — Mocks (decisao obrigatoria: implementar ou remover)

Estes recursos contem dados ficticios ou logica simulada. **Nunca** deixar como estao.

#### A1. Mock User
`apps/frontend/src/config/mock-user.ts`

Usuario ficticio (nome, role, email) usado no shell, profile e avatar. Importado diretamente — nao vem de nenhum fluxo de auth.

**Decisao:** Se o projeto tem autenticacao, substituir por dados do usuario logado. Se nao tem, remover o mock e simplificar os componentes que o consomem.

#### A2. Mock Notifications
`apps/frontend/src/routes/_shell.tsx` (array `mockNotifications`) e `apps/frontend/src/routes/_shell/notifications.tsx` (array `mockNotifications`)

Notificacoes fictícias hardcoded em dois lugares: no shell layout (painel dropdown) e na pagina dedicada.

**Decisao:** Se o projeto tem notificacoes, implementar fonte real (API, SSE, websocket). Se nao tem, remover os arrays mock, remover a pagina `/notifications`, remover o `NotificationPanel` do shell, e limpar a prop `notifications` do `AppShell`.

#### A3. Mock Login
`apps/frontend/src/routes/login.tsx`

Pagina de login com formulario que nao valida nada — o submit faz `router.navigate({ to: "/" })` diretamente. Nao chama API, nao gera token, nao seta cookie.

**Decisao:** Se o projeto tem auth, implementar o fluxo real (API call, JWT/cookie, redirect condicional). Se nao tem auth, remover a pagina.

#### A4. Mock API (Messages)
`apps/backend/src/routes/api.ts`

Endpoint demonstrativo `GET/POST /api/v1/messages`. GET retorna array vazio, POST cria in-memory sem persistencia. Existe apenas para demonstrar o pattern Hono + Zod + Event Bus.

**Decisao:** Remover e substituir pelas rotas de dominio do projeto real. Manter o pattern (Zod validation, event emission) como referencia ao implementar as novas rotas.

#### A5. Welcome Page
`apps/frontend/src/routes/_shell/index.tsx`

Home com cards de onboarding do scaffold ("Paginas", "Componentes", "Deploy"). Conteudo generico de boas-vindas.

**Decisao:** Substituir pelo conteudo real da home do projeto (dashboard, feed, lista, o que for). Nunca manter os cards de onboarding.

#### A6. Profile Page
`apps/frontend/src/routes/_shell/profile.tsx`

Exibe dados do mock-user. Depende inteiramente de A1.

**Decisao:** Se o projeto tem perfil de usuario, implementar com dados reais. Se nao tem, remover a rota e as referencias no menu.

#### A7. Mock Search (Breadcrumb Bar)
`packages/ui/src/components/app-shell/breadcrumb-bar.tsx`

Campo de busca no breadcrumb bar (mobile: toggle expandível, desktop: input fixo). Chama `onSearch?.(query)` no Enter, mas nenhum callback eh fornecido no `_shell.tsx`. A UI aparece, o submit nao faz nada.

**Decisao:** Se o projeto tem busca, conectar o callback `onSearch` no `_shell.tsx` com a logica real. Se nao tem, remover a prop `onSearch` do `BreadcrumbBar` e do `AppShell`, e remover o campo de busca do componente.

---

### Grupo B — Geradores (executar com assets do projeto)

Estes recursos sao pipelines de build que geram assets a partir de fontes. O scaffold vem com assets proprios — o projeto real deve substituir pelas suas fontes e rodar os geradores.

#### B1. Brand Pipeline (`npm run brand:derive`)
`scripts/derive-brand.mjs` + `assets/brand/{dark,light}/`

Pega SVGs de marca (icon, logo, logo-h, logo-v, creative-h, creative-v) e gera: PWA icons, maskable icons, favicons, apple-touch-icon, e SVGs in-app.

**Acao:**
1. Substituir os SVGs em `assets/brand/dark/` e `assets/brand/light/` pelos assets reais do projeto
2. Rodar `npm run brand:derive dark` ou `npm run brand:derive light` (escolher qual variante gera os icons externos)
3. Verificar `apps/frontend/public/icons/`, `public/brand/`, favicons

#### B2. Color Theme System (`npm run themes:build`)
`scripts/strip-themes.mjs` + `assets/themes/*.css` + `apps/frontend/src/themes/registry.ts`

40+ paletas de cores em oklch. Controlado por `VITE_COLOR_THEME` no `.env`:
- Se definido (ex: `VITE_COLOR_THEME=claude`): tema travado, usuario nao escolhe
- Se vazio: usuario escolhe na UI via Color Theme Picker

**Acao:**
1. Decidir se o projeto usa tema fixo ou permite escolha do usuario
2. Configurar `VITE_COLOR_THEME` no `.env` conforme a decisao
3. Rodar `npm run themes:build` para gerar os CSS e o registry
4. Se tema fixo: considerar purge dos temas nao usados de `public/themes/` (manter `assets/themes/` intacto)

---

### Grupo C — Infraestrutura (manter e configurar)

Estes recursos sao estruturais. Normalmente ficam no projeto, mas devem ser revisados e configurados.

#### C1. App Shell
`packages/ui/src/components/app-shell/`

Sidebar, breadcrumb-bar, shortcut-bar, shortcut-editor. Montado em `_shell.tsx`.

**Revisao:** Ajustar as props passadas ao `AppShell` em `_shell.tsx`: logo, user, navegacao. Remover props de mocks ja eliminados (notifications se removido, onSearch se removido).

#### C2. Menu System
`apps/frontend/src/config/menu.ts` + `packages/ui/src/components/app-menu/`

Menu data-driven com groups, items, icones e rotas. Inclui shortcuts customizaveis.

**Acao:** Reescrever `menu.ts` com as rotas e grupos reais do projeto. Os itens "home" e "settings" do scaffold sao placeholders — substituir pelo menu real.

#### C3. App Nav Panel
`packages/ui/src/components/app-nav-panel/`

Brand display, avatar-menu, widgets de notificacao.

**Revisao:** Ajustar conforme decisoes de A1 (user), A2 (notifications), B1 (brand).

#### C4. Color Theme Picker/Drawer/Provider
`packages/ui/src/components/color-theme-picker.tsx`, `color-theme-drawer.tsx`, `color-theme-provider.tsx` + `hooks/use-color-theme.ts`

UI para selecao de paleta + provider que carrega CSS dinamicamente.

**Decisao:** Se `VITE_COLOR_THEME` esta definido (tema fixo), o picker nao aparece na UI (ja controlado pelo `isFixed` flag). Se vazio, o picker funciona. Revisar se a pagina Settings/Theme ainda faz sentido conforme a decisao.

#### C5. Theme Provider (light/dark/system)
`packages/ui/src/components/theme-provider.tsx`

Toggle light/dark/system. Separado do color theme.

**Acao:** Manter. Funciona independentemente.

#### C6. PWA Reload Prompt
`apps/frontend/src/components/pwa-reload-prompt.tsx`

Banner "Nova versao disponivel" com service worker auto-update.

**Decisao:** Se o projeto eh PWA, manter. Se nao eh, remover e desabilitar `vite-plugin-pwa`.

#### C7. Environment Indicator
`apps/frontend/src/components/environment-indicator.tsx`

Badge fixo no topo: "DEVELOPMENT" ou "STAGING".

**Acao:** Manter. Util em todos os projetos. Some automaticamente em production.

#### C8. SSE / Realtime (Event Bus)
`apps/backend/src/routes/sse.ts` + `apps/backend/src/lib/event-bus.ts`

Server-Sent Events com event bus in-memory.

**Decisao:** Se o projeto usa realtime, manter e conectar aos eventos reais. Se nao usa, remover as rotas SSE e o event-bus.

#### C9. Page Layout
`packages/ui/src/components/page-layout.tsx`

Componente `PageDefault` para padronizacao de paginas.

**Acao:** Manter. Usar em todas as paginas novas.

#### C10. Settings + Theme Page
`apps/frontend/src/routes/_shell/settings.tsx` + `settings/theme.tsx`

Pagina de configuracoes com selecao de aparencia e paleta.

**Revisao:** Se o projeto tem settings, expandir. Se nao tem, avaliar se manter apenas o theme. Se nem theme faz sentido, remover.

#### C11. Platform Infra (Docker)
`infra/`

Docker Compose com postgres, redis, caddy. Scripts para up/down/ps/logs + secrets + kill-ports.

**Importante:**
- `npm run platform:up` sobe so infra (postgres, redis, caddy) para dev. Os apps rodam com `npm run dev`.
- `docker-compose.yml` eh deploy only (staging/production). Nao usar em dev.

**Decisao:** Revisar quais services de infra o projeto precisa. Remover services nao usados do compose.

#### C12. Data Volumes
`data/postgres/`, `data/redis/`

Volumes locais do Docker.

**Acao:** Manter. Gerenciados automaticamente pelo Docker.

#### C13. Error/NotFound States
`apps/frontend/src/components/error-state.tsx`, `not-found-state.tsx`

Componentes de fallback para erros e 404.

**Acao:** Manter. Customizar visual se necessario.

#### C14. JWT Secret Generator
`infra/scripts/gen-jwt-secret.mjs`

Gera secret para `.env`.

**Decisao:** Se o projeto usa JWT, manter e rodar `npm run gen:jwt-secret`. Se nao usa, remover.

#### C15. Secrets Manager
`infra/scripts/secrets.mjs`

Script de gestao de secrets.

**Decisao:** Manter se o projeto usa secrets alem do JWT. Remover se nao.

#### C16. E2E Test Harness
`tests/e2e/smoke.spec.ts` + `tests/playwright.config.ts`

Smoke test com Playwright.

**Acao:** Manter. Adaptar os testes ao projeto real.

---

### Grupo D — Documentacao e estrutura

#### D1. Guides Corpus
`guides/`

Guias tecnicos para a IA. Referencia permanente.

**Acao:** Manter. Consultar conforme necessidade.

#### D2. Component-First Guide
`guid/component-first/GUIDE.md`

Regras de uso do shadcn, CVA, tokens semanticos.

**Acao:** Manter. Consultar antes de criar componentes.

#### D3. Sprints Dir
`sprints/`

Diretorio para planejamento de sprints.

**Acao:** Manter. Usar conforme metodologia do projeto.

---

## Configuracao do .env

O `.env` eh a fonte da verdade. Ao derivar:

1. Renomear `PROJECT=scaffold` para o nome real do projeto
2. Ajustar `PUBLIC_DOMAIN` para o dominio real
3. Ajustar `VITE_COLOR_THEME` conforme decisao de B2
4. Gerar novo JWT secret: `npm run gen:jwt-secret`
5. Ajustar credenciais de banco (`POSTGRES_*`) se necessario

---

## Checklist final de derivacao

Apos todas as decisoes e implementacoes:

- [ ] Nenhum `mockUser`, `mockNotifications`, ou dado ficticio restante
- [ ] Nenhum `TODO: substituir` ou `placeholder` no codigo
- [ ] `menu.ts` reescrito com rotas reais
- [ ] Brand assets substituidos e `npm run brand:derive` executado
- [ ] `npm run themes:build` executado
- [ ] `.env` configurado para o projeto real
- [ ] `npm run build` passa sem erros
- [ ] `npm run typecheck` passa sem erros
- [ ] Welcome page substituida por conteudo real
- [ ] Login conectado a auth real (ou removido)
- [ ] Rotas da API reescritas para o dominio real
- [ ] Busca conectada ou removida
- [ ] Notificacoes conectadas ou removidas
- [ ] Profile conectado a dados reais ou removido

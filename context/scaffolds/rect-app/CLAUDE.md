# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Processo Decisorio: UI por Pagina

Este app eh um PWA **mobile-first com experiencia otimizada para web**. Nao eh um app mobile adaptado para web — ambas as experiencias devem ser planejadas.

Para cada pagina:
1. **Mobile primeiro**: como esta pagina se comporta no mobile?
2. **Web otimizada**: como esta pagina se comporta na web para experiencia otimizada? Nada de esticar componentes mobile. Planejar layout, densidade e interacoes para web.

## Monorepo

```
apps/frontend  — React 19 + Vite + TanStack Router + PWA (@scaffold/frontend)
apps/backend   — Hono + Pino (@scaffold/backend)
packages/ui    — @scaffold/ui (componentes compartilhados)
```

npm workspaces (`apps/*`, `packages/*`). Node >= 20.

## Portas

Definidas no `.env` — **sempre** leia o `.env` para saber as portas atuais. Nunca assuma valores.

## Comandos

```bash
npm run dev              # frontend + backend (concurrently, usa dotenv)
npm run dev:frontend     # so frontend
npm run dev:backend      # so backend
npm run typecheck        # todos os workspaces
npm run build            # todos os workspaces
npm run kill             # mata processos nas portas do projeto
npm run gen:jwt-secret   # gera JWT secret
```

### Frontend-specific

```bash
npm run lint -w @scaffold/frontend       # ESLint
npm run format -w @scaffold/frontend     # Prettier
```

### E2E (Playwright)

```bash
npm run test:e2e                                     # roda todos os testes e2e
npx playwright test --config tests/playwright.config.ts tests/e2e/smoke.spec.ts  # um arquivo especifico
```

Testes E2E exigem `npm run dev` rodando (frontend e backend nas portas do `.env`).

### Platform (Docker infra)

```bash
npm run platform:up      # sobe infra (postgres, redis, caddy)
npm run platform:down    # derruba infra
npm run platform:ps      # status
npm run platform:logs    # logs -f
```
## Execução

**Quando executado com `npm run dev` o log de execução do servidor é mantido no arquivo `.tmp/-run.log` para acompanhamento em tempo real.**

## Arquitetura

### Frontend

- **Base path**: `/app` (configurado no Vite, toda rota comeca com `/app`)
- **Roteamento**: TanStack Router file-based (`apps/frontend/src/routes/`)
  - `__root.tsx` — root layout (TooltipProvider)
  - `_shell.tsx` — layout autenticado com Sidebar + Breadcrumb + conteudo
  - `_shell/index.tsx` — home dentro do shell
  - `login.tsx` — pagina publica fora do shell
- **Path aliases**: `@` = `src/`, `@ui` = `packages/ui/src/`
- **Proxy Vite**: `/api/v1` e `/health` sao proxied para o backend
- **PWA**: `vite-plugin-pwa` com `registerType: "prompt"`

### Backend

- **Framework**: Hono com `@hono/node-server`
- **Rotas**: `GET /health`, `POST/GET /api/v1/messages`, `GET /api/v1/sse/events`
- **Validacao**: Zod schemas com `@hono/zod-validator`
- **Realtime**: SSE via `hono/streaming` + event-bus in-memory (`src/lib/event-bus.ts`)
- **Dev runner**: `tsx watch` (hot-reload)

### packages/ui (@scaffold/ui)

Componentes compartilhados exportados via package exports:
- `@scaffold/ui/components/*` — componentes UI (shadcn-based + app shell)
- `@scaffold/ui/hooks/*` — hooks reutilizaveis
- `@scaffold/ui/lib/*` — utilidades (cn, etc)

No frontend, importados via alias `@ui/components/...`.

## Docker Compose — platform vs dev-ports

- `infra/docker-compose.platform.yml` = services de infra sem portas expostas (comunicam via rede interna)
- `infra/docker-compose.platform.dev-ports.yml` = overlay que expoe portas pro host (so dev)
- `infra/docker-compose.yml` = producao (inclui platform + app services)

**Nunca** exponha portas de infra direto no `platform.yml`.

## **PROIBIDO: Defaults hardcoded em docker-compose ou config**

A fonte da verdade para configuracao eh o `.env`. **NUNCA** use `${VAR:-default}` em docker-compose ou arquivos de config. Defaults hardcoded mentem — o projeto nao tem defaults, tem valores definidos no `.env`. Se alguem esquecer de configurar uma variavel, o sistema deve **falhar imediatamente**, nao subir silenciosamente com um valor inventado que mascara a configuracao errada.

## Regra de Roteamento: Todo estado visivel deve ter rota

**Teste**: se o usuario pressionar F5 e o estado atual se perder, entao esse estado deveria ter uma rota propria.

Isso se aplica a paginas, guias/tabs, drawers, popups, modais — qualquer estado de UI que o usuario espera poder voltar ou compartilhar. Use search params, path params ou rotas dedicadas conforme apropriado. Estado efemero (tooltip, hover) nao precisa de rota.

## Convencoes

- Roteamento: TanStack Router (file-based, `src/routes/`)
- Estilo: Tailwind CSS 4 + shadcn/ui (via `npx shadcn`, nao eh dep)
- Icones: Phosphor Icons (`@phosphor-icons/react`) — **nao usar Lucide**
- Animacoes: Framer Motion
- Logging backend: Pino (nunca console.log)
- Validacao: Zod
- Fonte: Inter (principal), Plus Jakarta Sans, Lora, Roboto Mono
- **Componentes UI: shadcn primeiro, Tailwind custom nunca.** Antes de criar qualquer componente de UI, verificar se existe componente shadcn equivalente. Se existir, usar. Se nao existir, adicionar via `npx shadcn`. **NUNCA** montar componentes customizados com Tailwind quando shadcn tem solucao pronta. Detalhes: `guid/component-first/GUIDE.md`.

## Guias

| Guia | Caminho | Quando consultar |
|------|---------|------------------|
| Component-First (shadcn + DRY) | `guid/component-first/GUIDE.md` | **Antes** de criar ou modificar qualquer componente de UI. Define regras de uso do shadcn, CVA, tokens semanticos e quando criar componentes em `packages/ui`. |

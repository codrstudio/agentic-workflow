---
agent: coder
description: Estuda como levantar o app, sobe dependencias e dev server, executa smoke test E2E com Playwright, corrige problemas
---

# E2E Smoke Test

Levante o app do projeto do zero e execute um teste E2E com Playwright navegando pelas paginas para garantir que tudo funciona. Corrija qualquer problema encontrado.

## Fase 1 — Estudo do projeto

Antes de qualquer acao, entenda como o projeto funciona:

1. Leia `package.json` na raiz do projeto (e em subdiretorios se for monorepo)
   - Identifique scripts relevantes: `dev`, `start`, `build`, `platform:up`, `docker:up`, `compose:up`, etc.
   - Identifique dependencias (node_modules existe? precisa rodar `npm install`?)
2. Procure arquivos de infraestrutura:
   - `docker-compose.yml` / `docker-compose.yaml` / `compose.yml` / `compose.yaml`
   - `.env` / `.env.example` / `.env.local`
   - `Dockerfile`
3. Leia `README.md` se existir — pode conter instrucoes de setup
4. Identifique a porta do dev server (vite.config, next.config, package.json scripts, etc.)

**Registre suas descobertas** mentalmente antes de prosseguir. Voce precisa saber:
- Comando para subir dependencias de infra (containers Docker)
- Comando para instalar dependencias do projeto
- Comando para rodar o dev server
- Porta onde o app vai estar disponivel
- Variaveis de ambiente necessarias

## Fase 2 — Preparacao do ambiente

5. Se existir `.env.example` mas nao `.env`, copie: `cp .env.example .env`
6. Instale dependencias: `npm install` (ou o gerenciador de pacotes que o projeto usar)
7. Se houver containers Docker necessarios:
   - Prefira scripts do package.json: `npm run platform:up`, `npm run docker:up`, `npm run compose:up`
   - Se nao houver script, use diretamente: `docker compose up -d`
   - Aguarde os containers estarem healthy (verifique com `docker compose ps`)

## Fase 3 — Subir o app

8. Rode o dev server em background:
   - Prefira scripts do package.json: `npm run dev`
   - Rode com `&` ou redirecionando output para nao bloquear o terminal
   - **Anote o PID** do processo para matar depois
9. Aguarde o app estar pronto:
   - Tente `curl -s -o /dev/null -w "%{http_code}" http://localhost:{porta}` ate retornar 200
   - Timeout de 60 segundos — se nao subir, investigue os logs

## Fase 4 — Smoke Test com Playwright

10. Verifique se Playwright esta instalado:
    - Se nao, instale: `npx playwright install chromium`
11. Escreva um teste Playwright em `tests/e2e/smoke.spec.ts` (ou diretorio equivalente) que:
    - Abre o browser (chromium, headless)
    - Navega para `http://localhost:{porta}`
    - Aguarda a pagina carregar (networkidle ou domcontentloaded)
    - Verifica que a pagina renderizou conteudo (nao esta em branco)
    - Captura erros do console do browser (JS errors, exceptions)
    - Navega pelos links/rotas principais visiveis na pagina
    - Verifica que cada rota carrega sem erro
    - Tira screenshots como evidencia
12. Execute: `npx playwright test tests/e2e/smoke.spec.ts`

## Fase 5 — Correcao

13. Se a Fase 4 encontrou problemas:
    - Analise os erros (console errors, paginas quebradas, 404s, crashes)
    - Corrija o **codigo-fonte do app** (NAO ajuste o teste para esconder o problema)
    - Re-execute o teste (volte ao passo 12)
    - Repita ate o app funcionar limpo
14. Se o app nao subiu na Fase 3:
    - Leia os logs do dev server
    - Corrija erros de build, dependencias faltando, configs incorretas
    - Tente subir novamente

## Fase 6 — Cleanup

15. Mate o dev server pelo PID (NAO mate por nome de processo)
16. **Containers Docker devem continuar rodando** — nao derrube a infra, so o dev server
17. Screenshots ficam como evidencia — nao apague

## Regras

- **Prefira scripts do package.json** — nao invente comandos se o projeto ja tem scripts prontos
- **Estude antes de agir** — cada projeto e diferente, nao assuma nada
- **NAO mate processos pelo nome** (ex: `taskkill /IM node.exe`) — sempre pelo PID
- **NAO deixe processos orfaos** — mate tudo que voce subiu ao finalizar
- **Erros de console contam como falha** — JS errors no browser devem ser corrigidos
- **Se algo nao funcionar, investigue** — leia logs, verifique portas, cheque containers
- **Corrija o app, nao o teste** — se o teste revela um bug, o bug e no app

## Output

- Teste E2E passando
- Bugs corrigidos no codigo-fonte (se encontrados)
- Screenshots de evidencia
- Git commit com as correcoes (se houver)

---
agent: coder
description: Estuda como levantar o app, sobe dependencias e dev server, executa smoke test E2E com Playwright, corrige problemas
---

# E2E Smoke Test

Levante o app do projeto do zero e execute um teste E2E com Playwright navegando pelas paginas para garantir que tudo funciona. Corrija qualquer problema encontrado.

## Fase 1-3 — Levantar o app

Siga a skill `dev-launch` para:
1. Estudar o projeto (package.json, docker-compose, .env, porta)
2. Copiar `.env` dos artefatos do projeto (`{project}/.env`) se existir
3. Instalar dependencias
4. Subir infra Docker
5. Iniciar o dev server em background (anote o PID)

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
- Git commit seguindo a skill `git-commit` (se houver correcoes)

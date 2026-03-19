---
agent: coder
description: Executa um test case E2E via Playwright, corrige erros encontrados
---

# E2E Test

Execute o test case designado usando Playwright, corrija qualquer erro encontrado na interface.

## Orientacao

O loop de execucao ja selecionou o test case para voce. Seu trabalho e escrever o teste Playwright, executa-lo, e corrigir qualquer problema encontrado.

## Protocolo

1. Leia `{sprint}/test-cases.json` para contexto do test case e dependencias
2. Leia `{sprint}/features.json` para entender as features relacionadas
3. Verifique se Playwright esta instalado — se nao, instale (`npm init playwright@latest` ou adicione ao projeto)
4. Verifique se existe um arquivo de config do Playwright (`playwright.config.ts`) — crie se necessario

### Ciclo de teste

5. **Suba o app** — identifique o comando de dev (ex: `npm run dev`) e rode em background
6. **Aguarde o app estar pronto** — verifique que o servidor responde (ex: `curl http://localhost:...`)
7. **Escreva o teste Playwright** para o test case em `tests/e2e/` (ou diretorio equivalente do projeto)
8. **Execute o teste** — `npx playwright test <arquivo>`
9. **Analise os resultados**:
   - Se passou: marque como `passing` em `test-cases.json`
   - Se falhou: leia o output, identifique o problema
10. **Corrija o codigo da aplicacao** (NAO apenas o teste) se a falha for um bug de interface
11. **Re-execute o teste** apos corrigir ate passar
12. **Verifique o console do browser** — erros no console tambem devem ser corrigidos
13. **Mate o processo do dev server** ao finalizar (identifique o PID pela porta, NAO mate por nome)

## Regras

- O objetivo e que a interface FUNCIONE, nao apenas que o teste passe
- Se o teste revela um bug de UI, corrija o codigo-fonte — nao ajuste o teste para ignorar o problema
- Erros no console do browser (JS errors, warnings criticos) devem ser corrigidos
- Use seletores resilientes: `data-testid`, `role`, texto visivel — evite seletores frageis como classes CSS
- Cada test case deve ser independente (setup/teardown proprio)
- NAO deixe processos orfaos — sempre mate o dev server pelo PID no final

## Output

- Teste Playwright escrito e passando
- Bugs de interface corrigidos no codigo-fonte
- Console do browser limpo de erros
- Test case atualizado para `passing` em `{sprint}/test-cases.json` com `completed_at`
- Git commit com as correcoes e o teste

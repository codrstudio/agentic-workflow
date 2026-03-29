---
agent: coder
description: Implementa uma feature de codigo completamente numa sessao
needs: sprint
---

# Vibe Code

Implemente a feature designada completamente nesta sessao.

## Orientacao

O loop de execucao ja selecionou a feature para voce. Seu trabalho e implementa-la, testar e deixar o codigo em estado limpo.

## Protocolo

1. Leia `{sprint}/features.json` para contexto das features e dependencias
2. Se a feature tiver `prp_path`, leia o PRP para detalhes de implementacao
3. Leia specs relevantes em `{sprint}/2-specs/` para contexto tecnico
4. **Smoke test** — verifique que funcionalidade existente nao esta quebrada ANTES de codar
5. Se encontrar bugs de sessoes anteriores, corrija PRIMEIRO
6. Implemente a feature seguindo o PRP e specs
7. **Feedback loops** — rode typecheck, linter e testes relevantes apos implementar
8. Corrija ate todos os criterios em `tests` da feature passarem
9. **Clean state** — commit com mensagem descritiva, codigo pronto para merge

## Output

- Codigo implementado e commitado na worktree
- Feature atualizada para `passing` em `{sprint}/features.json` com `completed_at`

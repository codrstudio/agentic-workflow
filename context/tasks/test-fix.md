---
agent: coder
description: Roda testes, diagnostica falhas e corrige codigo ate tudo passar
needs: sprint
---

# Test & Fix

Rode a suite de testes do projeto, diagnostique falhas e corrija o codigo.

## Inputs

1. Leia `{sprint}/features.json` para entender quais features foram implementadas recentemente

## Protocolo

1. Se os testes precisam do app rodando, siga a skill `dev-launch` para levantar o ambiente
2. Rode a suite de testes completa (ou o subset relevante para features recentes)
2. Para cada falha:
   - Leia o teste que falhou e o codigo sob teste
   - Diagnostique a causa raiz
   - Corrija o CODIGO (nao o teste, a menos que o teste esteja genuinamente errado)
   - Re-rode o teste para confirmar a correcao
3. Rode typecheck e linter para validar que nada quebrou
4. Repita ate tudo passar
5. Se levantou o app, mate o dev server pelo PID (containers Docker devem continuar rodando)
6. Commit seguindo a skill `git-commit`, descrevendo o que quebrou e por que

## Regras

- NAO pule ou delete testes que falham
- NAO enfraqueça assertions para fazer testes passar
- Se um teste esta genuinamente errado (testando funcionalidade removida), corrija o teste com comentario explicando por que
- Mantenha correcoes MINIMAIS — nao refatore codigo nao relacionado

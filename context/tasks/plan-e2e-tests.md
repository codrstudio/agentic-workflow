---
agent: general
description: Planeja test cases E2E a partir das features implementadas
needs: sprint
---

# Plan E2E Tests

Planeje os test cases de E2E a partir das features implementadas e gere `test-cases.json`.

## Inputs

1. Leia `{sprint}/features.json` — lista de features implementadas (filtre as com status `passing`)
2. Leia o codigo da aplicacao na worktree para entender as interfaces implementadas
3. Identifique todas as telas, formularios, interacoes e fluxos de usuario

## Output

Produza `{sprint}/test-cases.json` no formato:

```json
[
  {
    "id": "TC-001",
    "name": "Nome curto do test case",
    "description": "Descricao do cenario: o que testar, passos, resultado esperado",
    "status": "pending",
    "priority": 1,
    "dependencies": [],
    "tests": ["criterio verificavel 1", "criterio verificavel 2"],
    "related_features": ["F-001", "F-002"]
  }
]
```

## Regras

- Cada test case deve cobrir um fluxo de usuario ou funcionalidade de interface verificavel via Playwright
- Foque em: navegacao, formularios, interacoes (click, hover, drag), feedback visual, erros de console
- Inclua test cases para: happy path, edge cases de UI (campos vazios, inputs invalidos), responsividade basica
- Priorize fluxos criticos (login, CRUD principal, navegacao core) antes de cenarios secundarios
- Dependencies devem formar um DAG sem ciclos
- NAO inclua testes de API pura — foque em E2E via interface
- NAO gere arquivos de teste Playwright ainda — apenas o plano em test-cases.json

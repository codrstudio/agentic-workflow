---
agent: general
description: Planeja features e gera/amplia features.json a partir dos PRPs
needs: sprint
---

# Plan Features

Planeje as features de implementacao a partir dos PRPs e gere o `features.json`.

## Inputs

1. Leia `{sprint}/3-prps/` — todos os PRPs da wave
2. Leia `{sprint}/1-brainstorming/ranking.json` para prioridades
3. Leia `{sprint}/features.json` se ja existir — nao duplicar features existentes

## Output

Produza `{sprint}/features.json` no formato:

```json
[
  {
    "id": "F-001",
    "name": "Nome curto da feature",
    "description": "Descricao detalhada do que implementar e como validar",
    "status": "pending",
    "priority": 1,
    "agent": "coder",
    "task": "vibe-code",
    "dependencies": [],
    "tests": ["criterio verificavel 1", "criterio verificavel 2"],
    "prp_path": "{sprint}/3-prps/nome-do-prp.md"
  }
]
```

## Formato dos PRPs

Consulte a skill `prp` para entender a estrutura de PRPs que voce esta decompondo em features.

## Regras

- Cada feature deve ser implementavel em UMA sessao de agente (escopo pequeno)
- Dependencies devem formar um DAG sem ciclos
- Priorize tarefas de risco tecnico primeiro (integracao, schema, infra) antes de UI rotineira
- Priorities devem refletir ordem logica (1 = mais urgente) e respeitar dependencies
- `tests` devem ser criterios verificaveis (o agente vai usar para validar)
- Se features.json ja existe, ADICIONAR novas features (nao sobrescrever as existentes)
- IDs devem continuar de onde o features.json existente parou

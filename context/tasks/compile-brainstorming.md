---
agent: general
description: Sintetiza materiais do projeto em brainstorming e ranking para a wave
needs: sprint
---

# Compile Brainstorming

Sintetize os materiais do projeto para produzir o brainstorming desta wave.

## Inputs

1. Leia `{project}/TASK.md` — escopo, objetivo e entregáveis definidos para esta wave
2. Leia TODOS os documentos em `{project}/sources/` — contexto de produto, domínio e referências
3. Escaneie `{repo}/sprints/` — se existirem sprints anteriores, leia seus brainstorming e ranking para não duplicar discoveries já registradas
4. Se houver código no repo, leia e liste funcionalidades já implementadas

## Output

Produza os artefatos em `{sprint}/1-brainstorming/`:

### brainstorming.md

Documento estruturado com seções:

- **Contexto** — resumo do que o projeto/tarefa pede, baseado no TASK.md
- **Funcionalidades mapeadas** — o que já existe no sistema (se houver código)
- **Lacunas e oportunidades** — o que falta implementar, inconsistências identificadas no TASK.md, gaps entre especificação e código
- **Priorizacao** — ranking das funcionalidades por impacto e ordem lógica de implementação (score 1-10 com justificativa)

### ranking.json

Array com TODAS as discoveries desta wave (e anteriores, se existirem):

```json
[
  {
    "id": "D-001",
    "type": "feature",
    "description": "...",
    "score": 8,
    "justification": "...",
    "sprint": 1,
    "implemented": false
  }
]
```

Mínimo 5 items por wave. Cada item com score justificado.

## Regras

- Não invente funcionalidades além do que está descrito em TASK.md e sources/
- Discoveries de sprints anteriores marcadas como implementadas devem manter esse status
- O brainstorming deve ser fiel ao material do projeto — não é pesquisa de mercado
- Se TASK.md listar inconsistências ou gaps, cada um deve aparecer como uma discovery

---
agent: general
description: Deriva specs tecnicas a partir do brainstorming e ranking da wave
needs: sprint
---

# Derive Specs

Derive especificacoes tecnicas a partir do brainstorming e ranking desta wave.

## Inputs

1. Leia `{sprint}/1-brainstorming/brainstorming.md` — dores, ganhos e priorizacao
2. Leia `{sprint}/1-brainstorming/ranking.json` — priorize discoveries com score mais alto nao implementadas
3. Leia docs em `{project}` para contexto de stack e infraestrutura
4. Escaneie `{repo}/sprints/` — leia specs de sprints anteriores para formato, convencoes e IDs

## Output

Produza specs em `{sprint}/2-specs/` — um arquivo `.md` por spec.

Cada spec deve conter:

- **ID** que continua de onde o sprint anterior parou (ex: S-005 se anterior terminou em S-004)
- **Objetivo** — o que resolver, referenciando discoveries do ranking
- **Schema DB** — tabelas, colunas, tipos, constraints (quando aplicavel)
- **API endpoints** — rotas, payloads, respostas (quando aplicavel)
- **Telas** — componentes, fluxos de usuario (quando aplicavel)
- **Criterios de aceite** — como validar que a spec foi implementada

## Regras

- Cada spec deve ser auto-contida e implementavel por um agente coder
- Specs devem ser INCREMENTAIS — adicionar ao que ja existe, nao reescrever
- Referenciar corretamente a stack do projeto (leia o codigo se necessario)
- Seguir convencoes de specs anteriores (se existirem)

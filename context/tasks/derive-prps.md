---
agent: general
description: Deriva PRPs a partir das specs da wave
---

# Derive PRPs

Derive PRPs (Product Requirement Prompts) a partir das specs desta wave.

## Inputs

1. Leia `{sprint}/2-specs/` — todas as specs da wave
2. Leia `{sprint}/1-brainstorming/brainstorming.md` e `{sprint}/1-brainstorming/ranking.json` para contexto de priorizacao
3. Escaneie `{repo}/sprints/` — leia PRPs de sprints anteriores para formato e convencoes

## Output

Produza PRPs em `{sprint}/3-prps/` — um arquivo `.md` por PRP.

Cada PRP deve conter:

- **Objetivo** — o que o PRP implementa, referenciando specs
- **Escopo** — tabelas, APIs, telas cobertas
- **Features** — lista de features atomicas que compoem o PRP
- **Limites** — o que NAO faz parte deste PRP
- **Dependencias** — outros PRPs que precisam estar prontos antes

## Regras

- PRPs sao sobre o APP (tabelas, APIs, telas) — nunca sobre o harness/engine
- Cada PRP deve ser auto-contido e implementavel independentemente por um agente coder
- Um PRP deve ser quebravel em features que cabem em UMA sessao de agente cada
- Seguir convencoes de PRPs anteriores (se existirem)

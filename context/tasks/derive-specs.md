---
agent: general
description: Deriva specs tecnicas a partir do brainstorming e ranking da wave
needs: sprint
---

# Derive Specs

Derive especificacoes tecnicas a partir do brainstorming e ranking desta wave, seguindo a skill `specs`.

## Inputs

1. Leia `{worktree}/.claude/skills/specs/SKILL.md` — a skill e a fonte de verdade sobre tipos, formato, IDs, dependencias entre specs e checklist de qualidade. **Obedeca a skill literalmente.**
2. Leia `{sprint}/1-brainstorming/brainstorming.md` e `{sprint}/1-brainstorming/ranking.json` — entenda dores, ganhos e priorizacao.
3. Leia docs em `{project}` e o codigo em `{worktree}` o suficiente para entender stack e contexto.
4. Escaneie `{repo}/sprints/` — specs de sprints anteriores mostram convencoes vigentes e ate onde os IDs chegaram.

## Output

Produza specs em `{sprint}/2-specs/`, um arquivo `.md` por spec, nomes e formato ditados pela skill.

## Regras

- A skill decide **quais tipos sao obrigatorios**, **quais sao opcionais**, **em que ordem** produzir e **como os IDs se relacionam entre tipos**. Nao tome essas decisoes aqui.
- Specs sao **incrementais**: continuem de onde o sprint anterior parou, nao reescrevam.
- Cada spec deve ser auto-contida e implementavel por um agente coder.
- Referencie a stack real do projeto — leia o codigo se tiver duvida.

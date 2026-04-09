---
agent: general
description: Deriva specs tecnicas a partir do brainstorming e ranking da wave
needs: sprint
---

# Derive Specs

Derive especificacoes tecnicas a partir do brainstorming e ranking desta wave.

## Inputs

1. Leia `{worktree}/.claude/skills/specs/SKILL.md` — padrao obrigatorio de formato, tipos e checklist de qualidade
2. Leia `{sprint}/1-brainstorming/brainstorming.md` — dores, ganhos e priorizacao
3. Leia `{sprint}/1-brainstorming/ranking.json` — priorize discoveries com score mais alto nao implementadas
4. Leia docs em `{project}` para contexto de stack e infraestrutura
5. Escaneie `{repo}/sprints/` — leia specs de sprints anteriores para formato, convencoes e IDs

## Output

Produza specs em `{sprint}/2-specs/` — um arquivo `.md` por spec.

Cada spec deve seguir um dos 6 tipos definidos na skill `specs` (lida no passo 1 dos Inputs). A skill define nome de arquivo, estrutura, prefixos de ID e checklist de qualidade — siga-a fielmente.

Escolha o tipo de spec adequado para cada discovery. Se uma discovery precisa de mais de um tipo (ex: ER + Feature Spec), produza arquivos separados.

IDs continuam de onde o sprint anterior parou (ex: S-005 se anterior terminou em S-004).

## Regras

- Cada spec deve ser auto-contida e implementavel por um agente coder
- Specs devem ser INCREMENTAIS — adicionar ao que ja existe, nao reescrever
- Referenciar corretamente a stack do projeto (leia o codigo se necessario)

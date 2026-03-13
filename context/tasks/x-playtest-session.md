---
agent: x-playtester
description: Roda sessao de playtesting com 6 agentes simulados jogando o jogo
---

# Playtest Session

Execute uma rodada completa de playtesting com 6 agentes simulados jogando o jogo.

## Inputs

1. Leia `{project}/TASK.md` — protocolo completo de playtesting (fases, agentes, questionarios)
2. Leia o README.md do repo para entender como rodar o jogo (`npm run dev:all`, `pnpm db:reset`, etc.)
3. Escaneie `{repo}/sprints/` — se existirem sprints anteriores, leia NEXT.md do ultimo para contexto
4. Se houver codigo no repo, entenda as mecanicas implementadas antes de jogar

## Fase 0 — Reset e Configuracao

1. Reset do ambiente conforme documentado no TASK.md (ex: `pnpm db:reset`)
2. Configure turnos rapidos para playtesting (conforme TASK.md)
3. Crie a pasta `{sprint}/1-brainstorming/` se nao existir
4. Crie subpastas: `{sprint}/1-brainstorming/agents/` e `{sprint}/1-brainstorming/interviews/`

## Fase 1 — Rodada de Jogo

Inicie o jogo e jogue como 6 agentes com perfis distintos, conforme definido no TASK.md do projeto.

Para cada agente:
1. Crie `{sprint}/1-brainstorming/agents/{agent-id}.md` com o prompt/personalidade
2. Jogue seguindo a estrategia declarada do agente
3. Mantenha log turno a turno em `{sprint}/1-brainstorming/agents/{agent-id}.log.md`

O log de cada turno DEVE conter:
- O que vejo (estado visivel do jogo)
- O que quero fazer (intencao)
- O que consegui fazer (acao realizada)
- Frustracoes (confusao, bloqueio, duvida)
- Surpresas positivas (satisfacao genuina)
- Avaliacao (1 frase)

**IMPORTANTE**: Jogue HONESTAMENTE. Frustracoes e confusoes sao os dados mais valiosos. Nao filtre pensamentos negativos.

## Fase 2 — Coleta Pos-Jogo

### Questionarios
Para cada agente, produza `{sprint}/1-brainstorming/interviews/{agent-id}.md` respondendo o questionario definido no TASK.md do projeto (blocos A-E).

### Ranking
Produza `{sprint}/1-brainstorming/ranking.md` com pontuacao e ranking final de todos os agentes.

### Entrevistas Especiais
- `{sprint}/1-brainstorming/interviews/champion.md` — entrevista aprofundada com o agente campeao
- `{sprint}/1-brainstorming/interviews/last-place.md` — entrevista aprofundada com o ultimo lugar

## Regras

- Interaja com o jogo REAL (via API, CLI, ou interface disponivel) — nao simule resultados
- Cada agente deve tomar decisoes INDEPENDENTES baseadas em sua estrategia
- O log deve refletir a experiencia REAL de interacao, nao uma narrativa inventada
- Se o jogo crashar ou tiver bugs, REGISTRE como pain critico no log
- Nao pesquise na internet — toda a analise vem da experiencia de jogar

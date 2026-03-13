---
agent: general
description: Analisa artefatos de playtesting e produz Value Map (pain/gain) da wave
---

# Playtest Analysis

Analise os artefatos de playtesting e produza o Value Map (pain/gain) desta wave.

## Inputs

1. Leia `{project}/TASK.md` — protocolo de analise (cruzamento log vs entrevista, mapa pain/gain)
2. Leia TODOS os logs de agentes em `{sprint}/1-brainstorming/agents/*.log.md`
3. Leia TODAS as entrevistas em `{sprint}/1-brainstorming/interviews/`
4. Leia `{sprint}/1-brainstorming/ranking.md` — resultado da rodada
5. Escaneie `{repo}/sprints/` — se existirem sprints anteriores, leia pain-gain.md e ranking.json para acumular

## Analise

### 1. Cruzamento log vs entrevista

Identifique divergencias entre o que os agentes registraram no log e o que responderam na entrevista. Divergencias sao os problemas mais honestos — o agente sofreu mas nao soube nomear.

### 2. Classificacao de Pains

Para cada pain identificado:
- **Interface**: o que bloqueou ou confundiu
- **Mecanicas**: o que nao foi compreendido
- **Diversao**: momentos de abandono ou frustracao
- **Agencia**: onde o jogador sentiu que nao tinha controle
- **Bugs**: crashes, erros, comportamento inesperado

### 3. Classificacao de Gains

- O que gerou satisfacao genuina
- O que fez o jogador querer continuar
- O que ja funciona — NAO MEXER

## Outputs

Produza os artefatos em `{sprint}/1-brainstorming/`:

### brainstorming.md

Documento estruturado com secoes:

- **Dores** — problemas reais identificados no playtesting, com evidencias dos logs
- **Ganhos** — pontos fortes confirmados pela experiencia de jogo
- **Alivios** — como o produto pode aliviar cada dor (proposta)
- **Criadores de ganho** — como o produto pode ampliar cada ganho
- **Priorizacao** — ranking por impacto (score 1-10 com justificativa)

### pain-gain.md

Tabela formatada com TODAS as discoveries (desta wave + anteriores):

```markdown
| ID | Tipo | Categoria | Descricao | Frequencia (x/6) | Score (1-10) | Sprint | Implementado? |
|----|------|-----------|-----------|-------------------|--------------|--------|---------------|
| D-001 | pain | mecanica | ... | 4/6 | 8 | 1 | nao |
```

Minimo 10 items novos por wave. Cada item com:
- Score justificado
- Frequencia: quantos dos 6 agentes reportaram o mesmo problema/ganho
- Citacao direta do log como evidencia

## Regras

- Evidencias devem vir dos LOGS e ENTREVISTAS — nunca de pesquisa externa
- Scores de 1-10 com justificativa de 1 linha
- Frequencia eh o dado mais forte: pain reportado por 5/6 agentes > pain reportado por 1/6
- Se houver ranking de sprints anteriores, reclassifique discoveries existentes
- Discoveries de sprints anteriores marcadas como implementadas devem manter esse status
- Divergencias log-vs-entrevista devem ser destacadas como insights criticos

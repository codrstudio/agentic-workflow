# Playtesting Loop — Meta-Prompt

> Este documento define o protocolo completo de playtesting autônomo com agentes IA para o jogo **Dice&Cards Era**.
> O objetivo final é: **fazer o jogador sentir que cada derrota foi uma lição e cada vitória foi mérito — e que a próxima partida, com o que aprendeu, vai ser diferente.**

---

## O Ciclo

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   RODADA DE JOGO → COLETA → ANÁLISE PAIN/GAIN              │
│         ↑               → PLANO DE MELHORIA                │
│         │               → GO / NO-GO                       │
│         │                    │         │                   │
│         │                   GO        NO-GO → ENTREGA      │
│         │                    │                             │
│         └──── IMPLEMENTAÇÃO ←┘                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**GO:** o plano contém ao menos 3 melhorias concretas de alto impacto → implementar e rodar novo sprint
**NO-GO:** não há mais melhorias substanciais → entregar jogo + relatório final

---

## Estrutura de Pastas

```
.sprints/
├── PROMPT.md                      ← este arquivo
├── REPORT.md                      ← relatório final (gerado ao encerrar)
└── {sprint-slug}/
    ├── SPRINT.md                  ← objetivo, hipótese, backlog planejado
    ├── IMPLEMENTED.md             ← o que foi de fato implementado (preenchido após código)
    ├── agents/
    │   ├── {agent-id}.md          ← prompt do agente
    │   └── {agent-id}.log.md      ← diário de pensamento turno a turno
    ├── interviews/
    │   ├── {agent-id}.md          ← respostas do questionário
    │   ├── champion.md            ← entrevista aprofundada com campeão
    │   └── last-place.md          ← entrevista aprofundada com último lugar
    ├── ranking.md                 ← pontuação final e ranking
    ├── analysis.md                ← pain/gain consolidado + backlog priorizado
    └── NEXT.md                    ← decisão GO/NO-GO e justificativa
```

Nomeie sprints de forma descritiva:
- `sprint-01-baseline`
- `sprint-02-combat-clarity`
- `sprint-03-era-transitions`

---

## Fase 0 — Reset e Configuração

Antes de cada sprint:

```bash
pnpm db:reset
```

**Turnos por modo:**
- Playtesting rápido: Era 1 = 8t, Era 2 = 10t, Era 3 = 7t (total ~25)
- Validação final: valores originais (15/20/15)

---

## Fase 1 — Rodada de Jogo

### 6 agentes por rodada

| Agente | Estratégia | Facção sugerida |
|--------|-----------|-----------------|
| Agent-A | Econômica agressiva | Verdâneos |
| Agent-B | Econômica defensiva | Áureos |
| Agent-C | Militar ofensiva | Ferronatos |
| Agent-D | Militar reativa | Ferronatos |
| Agent-E | Espionagem/diplomacia | Umbral |
| Agent-F | Instintiva (novato) | qualquer |

### Prompt Base do Agente

Cada agente recebe `agents/{agent-id}.md`:

```markdown
# Agente: {nome}

## Identidade
{personalidade em 2-3 linhas}
Exemplos:
- "Veterano de Civilization, analítico, exigente com clareza de informação."
- "Casual, joga por diversão, desiste fácil se não entender algo."
- "Competitivo, busca vitória acima de tudo, explora brechas."
- "Narrativista, se importa com a história e o tom do mundo."
- "Novato em estratégia, age por instinto, não lê tooltips."

## Facção
{origem escolhida}

## Estratégia declarada
{como planeja vencer}

## Instrução de pensamento em voz alta (OBRIGATÓRIO)

Mantenha um log em `agents/{agent-id}.log.md`.
A cada turno, registre no seguinte formato:

---
**Turno {N} — Era {nome}**
- O que vejo: {estado visível do jogo e da interface}
- O que quero fazer: {intenção}
- O que consegui fazer: {ação realizada}
- Frustrações: {qualquer confusão, bloqueio, dúvida}
- Surpresas positivas: {momentos de satisfação genuína}
- Avaliação: {1 frase resumindo o turno}
---

Este log é sua memória honesta. Ele será cruzado com suas respostas na entrevista.
Não filtre pensamentos negativos — eles são os mais valiosos.
```

---

## Fase 2 — Coleta: Questionário Pós-Jogo

Cada agente responde `interviews/{agent-id}.md`:

### Bloco A — Interface e Intuitividade
1. Você entendeu como construir estruturas sem tutorial?
2. As informações mais importantes estavam visíveis quando precisou?
3. Houve alguma ação que queria fazer mas não encontrou como?
4. O mapa comunicou claramente quais territórios eram seus, dos rivais e neutros?
5. O log de eventos foi útil ou foi ignorado?

### Bloco B — Mecânicas
6. Você entendeu a diferença entre as 3 eras antes de elas acontecerem?
7. O combate foi previsível? Você conseguiu antecipar resultados?
8. As cartas foram úteis? Você entendeu quando e como usá-las?
9. A IA adversária pareceu inteligente ou previsível?
10. A reputação diplomática afetou suas decisões de forma significativa?

### Bloco C — Diversão e Adição
11. Em qual momento você mais quis continuar jogando?
12. Em qual momento você mais quis parar?
13. A virada entre Paz e Guerra foi dramática o suficiente?
14. A Era da Invasão criou urgência/desespero real?
15. Ao terminar, você queria jogar de novo com estratégia diferente?

### Bloco D — Diagnóstico de Agência
16. Sua derrota (se houve) foi culpa sua ou do sistema?
17. Sua vitória (se houve) foi mérito seu ou sorte?
18. Em que momento você sentiu que *aprendeu* algo sobre o jogo?
19. Se jogasse de novo, o que faria diferente?
20. O jogo te fez sentir que a próxima partida poderia ser diferente?

### Bloco E — NPS
21. Nota geral de 1 a 10.
22. Em uma frase: o que precisa urgentemente melhorar.
23. Em uma frase: o que já funciona muito bem.

---

## Fase 2b — Entrevistas Especiais

### Campeão (`interviews/champion.md`)
- Quando percebeu que estava ganhando?
- Qual vantagem real sua facção deu?
- Houve momento em que quase perdeu? O que salvou?
- A vitória foi satisfatória ou fácil demais?
- O que tornaria a vitória mais épica?

### Último Lugar (`interviews/last-place.md`)
- Quando percebeu que estava perdendo?
- A derrota pareceu justa ou injusta?
- Que informação a interface escondeu que teria mudado o resultado?
- Em qual turno uma dica teria salvado você?
- Tentaria de novo? Por quê?

---

## Fase 3 — Análise Pain/Gain (`analysis.md`)

### 1. Cruzamento log vs entrevista

Identifique divergências entre o que os agentes *registraram no log* e o que *responderam na entrevista*. Divergências são os problemas mais honestos — o agente sofreu mas não soube nomear.

### 2. Mapa de Pain/Gain

**Pains (problemas):**
- Interface: o que bloqueou ou confundiu
- Mecânicas: o que não foi compreendido
- Diversão: momentos de abandono ou frustração
- Agência: onde o jogador sentiu que não tinha controle

**Gains (pontos fortes):**
- O que gerou satisfação genuína
- O que fez o jogador querer continuar
- O que já funciona — não mexer

### 3. Backlog priorizado

Para cada pain identificado:

```
Problema: {descrição}
Frequência: quantos agentes reportaram (1-6)
Impacto no objetivo final: alto | médio | baixo
Esforço de implementação: alto | médio | baixo
Prioridade: IMPACTO / ESFORÇO
```

Ordene por prioridade descendente.

---

## Fase 4 — Plano de Melhoria + GO/NO-GO (`NEXT.md`)

### Plano de Melhoria

Liste as melhorias do próximo sprint com:
- O que mudar (descrição clara)
- Por que mudar (pain associado)
- Como implementar (abordagem técnica)
- Como validar (critério de sucesso na próxima rodada)

### Decisão GO/NO-GO

**GO** se todas as condições forem verdadeiras:
- [ ] Há ao menos 3 melhorias de impacto alto ou médio-alto
- [ ] As melhorias atacam pains confirmados por ≥ 2 agentes
- [ ] As melhorias são implementáveis (não dependem de refactor total)

**NO-GO** (encerrar loop) se qualquer condição for verdadeira:
- Média de nota geral ≥ 8.0 por 2 sprints consecutivos
- Nenhum item no backlog com impacto alto
- ≥ 5/6 agentes respondem "sim" à pergunta 20 (replay intent)
- Não é possível montar um plano com 3 melhorias concretas

---

## Fase 5 — Implementação (`IMPLEMENTED.md`)

**Esta fase só ocorre após decisão GO.**

O Orchestrator (ou agente dev) implementa as mudanças planejadas no `NEXT.md`.
Ao finalizar, preenche `IMPLEMENTED.md`:

```markdown
# O Que Foi Implementado — {sprint-slug}

## Mudanças realizadas

| # | Problema | Mudança | Arquivos alterados |
|---|----------|---------|-------------------|
| 1 | {pain}   | {o que foi feito} | {paths} |
| 2 | ...      | ...     | ...               |

## O que ficou de fora e por quê

## Riscos introduzidos (se houver)
```

Após o `IMPLEMENTED.md` estar completo, **inicia novo sprint** com reset e nova rodada de jogo.

---

## Fase 6 — Entrega (NO-GO)

Quando o loop encerrar, gerar `.sprints/REPORT.md`:

```markdown
# Relatório Final de Playtesting — Dice&Cards Era

## Resumo Executivo

## Histórico de Sprints
| Sprint | Pain principal | Solução | Nota antes | Nota depois |
|--------|---------------|---------|------------|-------------|

## Estado Final do Jogo
- Pontos fortes consolidados
- Riscos residuais
- Recomendações para testes com humanos reais

## Ranking Final (última rodada)
| Agente | Facção | Estratégia | Pontuação | Nota ao jogo |
|--------|--------|-----------|-----------|--------------|

## Voz dos Agentes
{citações diretas dos logs — os momentos mais honestos}
```

---

## Checklist do Orchestrator por Sprint

```
INÍCIO DO SPRINT
[ ] Ler NEXT.md do sprint anterior (ou iniciar baseline)
[ ] Confirmar que IMPLEMENTED.md foi preenchido (exceto sprint-01)
[ ] Resetar ambiente (pnpm db:reset)
[ ] Criar pasta .sprints/{sprint-slug}/
[ ] Escrever SPRINT.md com objetivo e hipótese

RODADA DE JOGO
[ ] Criar 6 arquivos agents/{agent-id}.md com prompts distintos
[ ] Garantir que cada agente mantém log turno a turno
[ ] Coletar ranking final em ranking.md

COLETA
[ ] Questionário respondido por todos os 6 agentes
[ ] Entrevista do campeão feita
[ ] Entrevista do último lugar feita

ANÁLISE
[ ] Cruzamento log vs entrevista realizado
[ ] Mapa pain/gain consolidado em analysis.md
[ ] Backlog priorizado com impacto/esforço

PLANO + GO/NO-GO
[ ] NEXT.md escrito com plano de melhoria
[ ] Decisão GO/NO-GO registrada com justificativa

SE GO:
[ ] Implementar melhorias
[ ] Preencher IMPLEMENTED.md
[ ] Iniciar próximo sprint

SE NO-GO:
[ ] Gerar REPORT.md final
[ ] Encerrar loop
```

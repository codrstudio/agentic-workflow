---
agent: general
description: Avalia viabilidade do Value Map e decide GO/STOP
needs: sprint
---

# Go / No-Go Decision

Avalie o Value Map produzido na etapa anterior e decida se o ciclo continua (GO) ou para (STOP).

## Inputs

1. Leia `{sprint}/1-brainstorming/brainstorming.md` e `{sprint}/1-brainstorming/pain-gain.md`
2. Escaneie `{repo}/sprints/` — se existirem sprints anteriores, leia seus ranking.json para acumular
3. Leia docs em `{project}` para contexto do produto

## Criterios de decisao

1. Pontue todos os pain/gain de 1-10
2. Analise discoveries desta wave:
   - Maioria abaixo de 3 E nenhuma acima de 7 nao implementada → **STOP**
   - Discoveries acima de 7 nao implementadas → **GO**
3. **Wave 1 é SEMPRE GO** — retorne `stop: false` incondicionalmente se `{wave_number}` for 1. Primeiras waves têm valor intrínseco e não devem ser bloqueadas pela análise

## Artefato

Produza `{sprint}/1-brainstorming/ranking.json` acumulando todas as discoveries:

```json
{
  "wave": {wave_number},
  "sprint": {sprint_number},
  "decision": "go",
  "decision_rationale": "Justificativa detalhada",
  "discoveries": [
    {
      "id": "D-001",
      "type": "pain",
      "description": "...",
      "score": 8,
      "discovered_at": 1,
      "last_reclassified_at": {sprint_number},
      "implemented_at": null
    }
  ]
}
```

## Regras

- ACUMULAR todas as discoveries de todos os sprints (anteriores + atual)
- Reclassificar discoveries existentes (atualizar `last_reclassified_at`)
- Preservar `implemented_at` para discoveries ja implementadas

## Output

Retorne exclusivamente um JSON com:

```json
{
  "stop": false,
  "reason": "Justificativa de uma linha"
}
```

- `stop: true` apenas quando os critérios indicam STOP (maioria de discoveries baixas, sem altas implementadas)
- `reason` deve ser descritivo (ex: "Todas as discoveries abaixo de 3, nenhuma acima de 7 implementada" ou "Discoveries de alto valor pendentes de implementação")

---
agent: general
description: Avalia se deve continuar encadeando waves
---

# Wave Limit

Avalie se o workflow deve encadear mais uma wave ou parar.

## Inputs

1. Leia `{sprint}/features.json` para resultado da wave atual
2. Escaneie `{repo}/sprints/` para historico de ranking e features de sprints anteriores

## Criterios de decisao

1. **Limite de waves**: wave atual >= 5 → pare
2. **Rendimentos decrescentes**: ultimos 2 sprints com menos de 3 features cada → pare
3. **Valor esgotado**: nao ha discoveries com score > 5 nao implementadas → pare
4. **Taxa de falha**: wave atual com mais de 50% das features skipadas → pare
5. **Valor restante**: discoveries com score alto nao implementadas → continue

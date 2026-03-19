---
agent: general
description: Resolver conflitos de pull no repo
---

# Resolve Pull Conflicts

O `git pull` no repo falhou (conflito ou outro erro). Sua tarefa e resolver os conflitos e deixar o repo atualizado com o branch remoto.

## Inputs

- Repo: `{repo}`
- Branch: `{target_branch}`

## Procedimento

### Passo 1 — Diagnostico

Verifique o estado atual do repo:

1. `git status` — ha merge em andamento? conflitos nao resolvidos?
2. `git log --oneline -5` — ultimos commits locais
3. `git log --oneline -5 origin/{target_branch}` — ultimos commits remotos

### Passo 2 — Resolucao

- Se houver merge em andamento com conflitos: resolva os conflitos, preferindo manter ambas as alteracoes quando possivel
- Se os conflitos forem irreconciliaveis, prefira o codigo remoto (origin) pois e o mais atualizado
- Apos resolver, faca commit do merge
- Valide com `git status` que nao ha pendencias

### Passo 3 — Verificacao

- Execute `git log --oneline -3` para confirmar que o merge commit existe
- Confirme que `git status` esta limpo

## Output

Retorne exclusivamente um JSON:

```json
{
  "success": true,
  "error": null
}
```

- `success`: true se os conflitos foram resolvidos e o pull esta completo
- `error`: null se sucesso, ou mensagem descritiva se falhou

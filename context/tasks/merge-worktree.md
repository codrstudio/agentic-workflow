---
agent: general
description: Merge worktree da wave de volta para repo
---

# Merge Worktree

Faca merge do trabalho da wave de volta para o repo.

Esta tarefa pode estar sendo executada pela primeira vez ou em modo de recuperacao de uma falha anterior. Trate ambos os casos da mesma forma: sempre comece com um diagnostico completo antes de agir.

## Inputs

- Worktree da wave: `{worktree}`
- Repo: `{repo}`
- Branch de destino: `{target_branch}`

## Procedimento

### Passo 1 — Inventario de tarefas

As etapas do merge sao, em ordem:

1. Commit de alteracoes pendentes na worktree
2. Checkout de `{target_branch}` no repo
3. Merge do branch da wave em `{target_branch}`
4. Remocao da worktree
5. Delecao do branch local da wave

### Passo 2 — Diagnostico

Para cada etapa acima, verifique o estado atual e classifique como `concluida`, `pendente` ou `falhou`:

- Worktree existe? Ha alteracoes nao commitadas?
- O repo esta no branch correto (`{target_branch}`)?
- Ha um merge em andamento (`MERGE_HEAD` existe)? O branch da wave ja esta no log de `{target_branch}`?
- A worktree ainda esta registrada (`git worktree list`)?
- O branch da wave ainda existe?

Se detectar estado inconsistente (merge pela metade, conflitos nao resolvidos, worktree corrompida), remedeie antes de prosseguir.

### Passo 3 — Execucao

Execute apenas as etapas classificadas como `pendente` ou `falhou`, na ordem correta:

1. Se houver alteracoes pendentes na worktree: commit com mensagem descritiva
2. No repo, faca checkout de `{target_branch}`
3. Se o merge ainda nao foi concluido: faca merge do branch da wave
   - Para conflitos simples (adicao paralela), resolva manualmente
   - Para conflitos complexos, prefira o codigo da wave (eh o mais recente)
   - Valide com typecheck/build apos resolver conflitos
4. Remova a worktree com `git worktree remove --force`
5. Delete o branch local da wave

## Output

Retorne exclusivamente um JSON com:

```json
{
  "ok": true,
  "merged_sha": "abc1234def5678",
  "error": null
}
```

- `ok`: true se o merge foi concluído com sucesso, false caso contrário
- `merged_sha`: SHA completo do commit de merge (resultado de `git rev-parse HEAD` no repo após merge bem-sucedido)
- `error`: null se sucesso, ou mensagem de erro descritiva se falhou

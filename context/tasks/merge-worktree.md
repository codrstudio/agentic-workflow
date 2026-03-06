---
agent: general
description: Merge worktree da wave de volta para repo
---

# Merge Worktree

Faca merge do trabalho da wave de volta para o repo.

## Inputs

1. Verifique o estado do git na worktree e no repo
2. O branch de destino para merge e: `{target_branch}`

## Procedimento

1. Na worktree, verifique se ha alteracoes pendentes
   - Se sim: commit com mensagem descritiva
2. No repo, faca checkout do branch `{target_branch}`
3. Faca merge do branch da wave com mensagem descritiva
4. Se houver conflitos:
   - Para conflitos simples (adicao paralela), resolva manualmente
   - Para conflitos complexos, prefira o codigo da wave (eh o mais recente)
   - Valide com typecheck/build apos resolver
5. Remova a worktree com `git worktree remove`
6. Se o merge foi bem-sucedido, delete o branch local da wave

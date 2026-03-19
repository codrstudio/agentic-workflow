---
agent: coder
description: Integra o trabalho do harness na branch remota e faz push
---

# Push Repo

Integre o trabalho do harness na branch de origem do projeto e faca push.

## Inputs

- Repo: `{repo}`
- Branch local (harness): `{target_branch}`
- Branch remota (origin): `{source_branch}`
- Projeto: `{project}`
- Sprint: `{sprint}`

## Protocolo

1. Navegue ate o repo: `{repo}`
2. Commite alteracoes pendentes se houver
3. Faca `git fetch origin`
4. Tente push direto: `git push origin {target_branch}:{source_branch}`
5. Se o push falhar por divergencia:
   - Leia o historico de commits do remote desde a divergencia (`git log {target_branch}..origin/{source_branch}`)
   - Leia o historico local do harness (`git log origin/{source_branch}..{target_branch}`)
   - Entenda o que cada lado fez e por que
   - Faca `git merge origin/{source_branch}` na branch `{target_branch}`
   - Resolva conflitos com conhecimento de causa — leia o codigo, entenda a intencao de cada lado
   - **Feedback loops** — rode typecheck, build e testes relevantes apos o merge
   - Corrija ate ficar limpo
   - Commit do merge
   - `git push origin {target_branch}:{source_branch}`
6. **JAMAIS force push.**

## Output

- Branch `{source_branch}` atualizada no remote com o trabalho do harness integrado

---
agent: coder
description: Puxa alteracoes do remote e integra na branch local do harness
---

# Pull Repo

Puxe as alteracoes mais recentes do remote e integre na branch local do harness.

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
4. Tente merge direto: `git merge origin/{source_branch}`
5. Se o merge falhar por conflito:
   - Leia o historico de commits do remote desde a divergencia (`git log {target_branch}..origin/{source_branch}`)
   - Leia o historico local do harness (`git log origin/{source_branch}..{target_branch}`)
   - Entenda o que cada lado fez e por que
   - Resolva conflitos com conhecimento de causa — leia o codigo, entenda a intencao de cada lado
   - **Feedback loops** — rode typecheck, build e testes relevantes apos o merge
   - Corrija ate ficar limpo
   - Commit do merge
6. **JAMAIS force push.**

## Output

- Branch `{target_branch}` atualizada com as alteracoes mais recentes de `origin/{source_branch}`

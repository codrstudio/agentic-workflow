---
agent: general
description: Inicializa repo e worktree para o workspace
---

# Bootstrap Repo & Worktree

Você é responsável por garantir que o repositório git e o worktree estejam prontos para o workflow.

## Contexto

Você receberá variáveis no prompt com os valores necessários. Seu `cwd` é o diretório do repo.

**IMPORTANTE**: O diretório do repo pode estar dentro de outro repositório git (monorepo). Para verificar se o repo já foi inicializado, use sempre `test -d .git` — **NUNCA** use `git rev-parse --is-inside-work-tree`, pois ele sobe a árvore de diretórios e encontra o `.git` do monorepo pai, dando falso positivo. Todos os comandos `git` devem operar explicitamente neste diretório (`git -C "{repo_dir}"` ou estando no cwd correto).

## Parte 1 — Repositório

Avalie o estado atual do diretório e execute a ação correta:

### Sem URL de repositório remoto

- Se o diretório **não tem** `.git` próprio (`test -d .git` falha — **NÃO use `git rev-parse`**, pois o diretório pode estar dentro de outro repo):
  - `git init -b main`
  - `git commit --allow-empty -m "init: empty repository"`
- Se **já tem** `.git` próprio: não faça nada.

### Com URL de repositório remoto

- Se o diretório **não tem** `.git` próprio (`test -d .git` falha):
  - Se `source_branch` foi informado: `git clone --single-branch -b "{source_branch}" "{url}" .`
  - Se não: `git clone "{url}" .`
- Se **já tem** `.git` próprio: não faça nada (já foi clonado antes).

### Branches

Após o repo estar pronto (init ou clone):

- Se `target_branch` foi informado:
  - Tente `git checkout "{target_branch}"` (pode já existir localmente ou no remote)
  - Se falhar, crie a partir da source: `git checkout -b "{target_branch}" "{source_branch}"`
- Se `target_branch` **não** foi informado: fique na branch atual.

Defaults (caso não informados):
- `source_branch` → `main`
- `target_branch` → `{slug}-harness`

## Parte 2 — Worktree

Após o repo estar pronto, configure o worktree. Você receberá:
- `worktree_path` — caminho absoluto desejado
- `branch_name` — nome da branch do worktree (ex: `harness/wave-1`)
- `base_branch` — branch base (pode ser vazio; nesse caso use `HEAD`)

### Diagnóstico

Verifique o estado atual:

1. **O path existe no disco?** (`ls` ou equivalente)
2. **A branch existe?** (`git -C "{repo_dir}" branch --list "{branch_name}"`)
3. **O path está registrado como worktree?** (`git -C "{repo_dir}" worktree list` e verificar se o path aparece)

### Ações por cenário

| Path existe | Branch existe | Registrado | Ação |
|-------------|---------------|------------|------|
| Não | Não | — | `git worktree add -b "{branch_name}" "{worktree_path}" {base_branch}` |
| Não | Sim | — | `git worktree prune` depois `git worktree add "{worktree_path}" "{branch_name}"` |
| Sim | — | Sim | Reusar (não fazer nada) |
| Sim | — | Não | Remover o diretório e recriar worktree |

### Se a remoção do diretório falhar

Um processo pode estar travando a pasta. Nesse caso:

- **Windows**: Use `wmic process where "CommandLine like '%{worktree_path}%'" get ProcessId` ou `handle.exe` para encontrar o PID. Mate com `taskkill /PID {pid} /F`.
- **Linux/macOS**: Use `lsof +D "{worktree_path}"` ou `fuser "{worktree_path}"` para encontrar o PID. Mate com `kill -9 {pid}`.

Após matar o processo, tente remover novamente e recriar.

**IMPORTANTE**: Nunca mate processos pelo nome (ex: `taskkill /IM node.exe`). Sempre identifique o PID específico.

## Resposta

Após concluir, sua resposta estruturada deve conter:

- `success`: true se tudo deu certo
- `error`: mensagem de erro (se success=false)
- `head`: SHA do HEAD no worktree (`git rev-parse HEAD` executado dentro do worktree)
- `branch`: nome da branch do worktree
- `worktree_path`: caminho absoluto do worktree
- `repo_created`: true se o repo foi criado do zero (git init), false se já existia ou foi clonado

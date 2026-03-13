# Harness

## O que eh

O agentic-workflow eh uma fabrica de software autonoma. Um orquestrador deterministico que executa workflows compostos por agentes de IA (Claude Code CLI) para construir produtos de ponta a ponta — da pesquisa de mercado ao codigo entregue.

O harness nao toma decisoes criativas. Ele gerencia o fluxo: qual agente spawnar, em que ordem, com qual contexto, o que fazer quando falha, quando parar, quando encadear. As decisoes criativas ficam com os agentes.

## Entidades

### Projeto

Definicao do que sera construido. Vive em `context/projects/{slug}/`. Contem briefing, materiais de referencia e artefatos derivados (concept, specs). Eh input — o harness le mas nao modifica.

O projeto pode opcionalmente especificar um `repo` (URL git do repositorio do produto). Se presente, o engine clona; se ausente, inicializa um repo local.

Ver: [project-concept/GUIDE.md](../project-concept/GUIDE.md)

### Workflow

Lista ordenada de steps num YAML. Vive em `context/workflows/{slug}.yaml`. Define **a sequencia** de trabalho, nao o trabalho em si — cada step aponta para uma task.

### Task

Prompt markdown que descreve **o que fazer** numa sessao. Vive em `context/tasks/{slug}.md`. Frontmatter indica qual agent profile usar. Body descreve objetivo, inputs, outputs, regras.

### Agent

Profile markdown que descreve **como se comportar**. Vive em `context/agents/{slug}.md`. Frontmatter configura tools permitidas, max turns, timeout. Body define protocolo de startup, regras, formato de commit.

### Workspace

Instancia de execucao. Criado automaticamente pelo engine a partir de um projeto + workflow. Vive em `context/workspaces/{slug}/`. Contem o `workspace.json` (referencia ao projeto), o repo (produto) e as waves (estado de execucao).

Ver: [workspace-layout/GUIDE.md](../workspace-layout/GUIDE.md)

## Parametros de entrada

O harness precisa de dois parametros para iniciar:

| Parametro | Descricao |
|-----------|-----------|
| `project` | Slug do projeto em `context/projects/` |
| `workflow` | Slug do workflow em `context/workflows/` |

Tudo mais eh derivado: o engine le o `project.json` para encontrar artefatos e repo, le o workflow YAML para saber os steps, cria o workspace automaticamente.

## Ciclo de execucao

```
engine recebe (project, workflow)
  → resolve context/projects/{slug}/ → le project.json
  → resolve context/workflows/{slug}.yaml → parseia steps
  → cria workspace em context/workspaces/{slug}/
    → gera workspace.json (referencia ao projeto + workflow)
    → clone/init repo (usando repo do projeto, se houver)
  → inicia wave-1
    → cria worktree de repo (isolamento git)
    → cria sprints/sprint-{n}/ na worktree
    → executa steps sequencialmente
    → ao final, spawna merge em background (worktree → repo)
    → se chain-workflow: inicia wave seguinte em paralelo com merge
```

Se o workspace ja existe (reexecucao), o engine retoma: detecta o numero da proxima wave, reutiliza o repo existente.

## Composicao de prompt

Cada spawn do Claude CLI recebe um prompt composto de duas partes:

```
[agent profile body]        ← quem voce eh, como se comportar
---
# Task: {task-slug}
[task body]                 ← o que fazer nesta sessao
```

A task define no frontmatter qual agent usar. O engine resolve o agent profile, renderiza ambos com template variables, concatena e envia via stdin ao processo.

### Template variables

Variaveis `{nome}` nos prompts sao substituidas em runtime:

| Variavel | Valor |
|----------|-------|
| `{workspace}` | raiz do workspace |
| `{project}` | pasta de artefatos do projeto (target_folder) |
| `{repo}` | raiz do repo (produto) |
| `{worktree}` | worktree da wave atual |
| `{sprint}` | `repo/sprints/sprint-{n}/` |
| `{wave_number}` | numero da wave |
| `{sprint_number}` | numero do sprint |

Parametros extras do `project.json` (`params`) tambem sao injetados como variaveis.

## 4 step types

### spawn-agent

Spawna um agente uma vez. Exit code 0 = sucesso, workflow avanca. Exit code != 0 = falha, workflow para.
O engine opcionalmente avalia uma arrow function (`stop_on`) contra a resposta. Se retorna truthy, o workflow para (sem erro). Permite decisoes autonomas: "o go-no-go decidiu parar", "o wave-limit decidiu que ja chega".

### ralph-wiggum-loop

Itera sobre `{sprint}/features.json`. A cada iteracao:

1. Seleciona a proxima feature actionable (prioridade + dependencias satisfeitas)
2. Compoe prompt com agent + task + contexto da feature (nome, descricao, testes)
3. Spawna agente
4. Avalia resultado: se passou, avanca; se falhou, GutterDetector decide retry, rollback ou skip

Repete ate todas as features passarem, serem skipped, ou atingir limites configurados. Cada tentativa fica em `F-XXX-attempt-N/` preservando historico completo.

### chain-workflow

Invoca outro workflow YAML (ou o mesmo, recursivamente). O engine le, parseia e executa. Isso permite encadeamento automatico de waves — o `vibe-app` termina com `chain-workflow: vibe-app`, criando waves sucessivas. O step anterior (`wave-limit` como spawn-agent) decide se deve continuar ou parar.

## Spawn: processo e registro

Cada invocacao do Claude CLI eh um processo filho do engine. O agent profile configura:

- **allowedTools** — ferramentas disponiveis (Edit, Bash, WebSearch, etc.)
- **max_turns** — limite de turnos do agente
- **timeout_minutes** — timeout por inatividade

Cada spawn produz dois arquivos na sua pasta:

- `spawn.json` — metadata (task, agent, pid, timestamps, exit code, timed_out)
- `spawn.jsonl` — transcript completo do Claude CLI

O `spawn.json` eh escrito antes do spawn (pid=0) e atualizado apos (pid real, exit code). Se `finished_at` nao existe, o spawn morreu inesperadamente.

## Wave vs Sprint

- **Wave** = uma execucao do workflow. Conceito do engine. Toda execucao cria uma wave, mesmo se falhar.
- **Sprint** = conjunto de artefatos entregaveis dentro do repo. Conceito do produto. So existe se a wave produziu material.

Numeros independentes. Nem toda wave gera um sprint.

## Dois gits

| Git | Responsabilidade | Comita quando |
|-----|-----------------|---------------|
| workspace | estado do harness (waves, metadata) | a qualquer momento |
| repo | produto entregue (codigo, sprints) | apos merge de wave bem-sucedida |

A separacao garante que falhas no harness nao corrompem o produto.

## Merge

O merge nao eh um step do workflow. Eh executado pelo engine apos o workflow terminar — um agente que recebe a worktree e o repo e faz a integracao (resolve conflitos, limpa, comita). Roda em background para nao bloquear o inicio da proxima wave.

## Encadeamento

```
wave-1
  steps 1-7 executam sequencialmente
  wave-limit decide: continuar
  chain-workflow → engine cria wave-2
  merge de wave-1 roda em background

wave-2 (em paralelo com merge da wave-1)
  steps 1-7 executam sequencialmente
  wave-limit decide: parar
  workflow termina
  merge de wave-2 roda em background
```

O unico paralelismo eh merge + inicio da proxima wave. Dentro de uma wave, tudo eh sequencial — um agente por vez.

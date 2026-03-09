# Projeto

## Visao geral

Um projeto eh a unidade de concepcao do agentic-workflow. Ele contem o briefing, os materiais de referencia e os artefatos derivados — tudo que define **o que** sera construido, antes de qualquer linha de codigo.

O projeto vive em `context/projects/{slug}/` e eh referenciado por workspaces. Isso separa a definicao do produto (projeto) da execucao (workspace/wave).

## Estrutura

```
context/projects/{slug}/
├── project.json            ← identidade e config do projeto
├── {source_folder}/        ← materiais de origem (docs, referencias, exemplos)
│   └── ...
└── {target_folder}/        ← artefatos derivados (concept, specs, PRPs)
    └── ...
```

Os nomes das pastas de sources e artifacts sao configuraveis via `project.json`. Exemplo do projeto Agentic Workflow:

```
context/projects/arc/
├── project.json
├── sources/                ← source_folder = "sources"
│   └── .gitkeep
└── artifacts/              ← target_folder = "artifacts"
    └── concept.md
```

## project.json

```json
{
  "name": "Agentic Workflow",
  "slug": "aw",
  "description": "Add/Relate/Communicate - Interface de gestao de projetos",
  "tags": ["product", "frontend", "v0"],
  "source_folder": "sources",
  "target_folder": "artifacts",
  "created_at": "2026-03-05",
  "status": "brainstorming"
}
```

| Campo | Descricao |
|-------|-----------|
| `name` | Nome legivel do projeto |
| `slug` | Identificador unico (nome da pasta) |
| `description` | Descricao curta do projeto |
| `tags` | Tags para organizacao e filtragem |
| `source_folder` | Nome da pasta de materiais de origem |
| `target_folder` | Nome da pasta de artefatos derivados |
| `created_at` | Data de criacao |
| `status` | Estado atual (ex: `brainstorming`, `speccing`, `building`, `done`) |

## Dois lados: sources e artifacts

### Sources (source_folder)

Insumos brutos do projeto. Documentos de referencia, exemplos de mercado, notas de conversa, qualquer material que informe o que sera construido. Sao **input** — o agente le mas nao modifica a menos que explicitamente solicitado.

### Artifacts (target_folder)

Derivados do processo de concepcao. O `concept.md`, specs tecnicas, PRPs, value maps — tudo que sai da reflexao sobre os sources. Sao **output** do processo de concepcao e **input** do processo de construcao.

## Relacao projeto -> workspace

O projeto nao sabe que workspaces o referenciam. A relacao eh unidirecional:

```
context/projects/arc/           ← definicao do produto (imutavel pelo harness)
       │
       ▼  (referenciado por)
context/workspaces/arc/         ← execucao (waves, worktrees, estado)
  workspace.json:
    { "project": "arc", ... }
```

O `workspace.json` contem o campo `project` com o slug. O engine resolve isso para `context/projects/{slug}/` e usa o `target_folder` do `project.json` para encontrar os artefatos.

Isso garante:

- **Source of truth unica** — o projeto vive em `context/projects/`, sem duplicacao
- **Workspace leve** — nao copia arquivos de briefing
- **Atualizacao imediata** — mudancas nos artefatos do projeto sao visiveis pelo workspace sem sync

## Relacao projeto -> engine

O engine conhece projetos via o `ProjectSchema`:

```typescript
// apps/engine/src/schemas/project.ts
export const ProjectSchema = z.object({
  name: z.string(),
  workflow: z.string(),
  docs: z.string(),
  workspace: z.string(),
  params: z.record(z.unknown()).optional(),
});
```

O campo `docs` aponta para a pasta de artefatos do projeto (resolvida a partir de `target_folder`). O campo `workflow` indica qual workflow YAML executar. O campo `params` permite parametros extras que sao injetados como template variables nos prompts dos agentes.

## Lifecycle de um projeto

```
1. Criacao
   └── context/projects/{slug}/ com project.json + pastas

2. Concepcao (pode ser iterativa)
   ├── Adicionar sources (docs, refs, exemplos)
   ├── Conversar com agente sobre os sources (via ARC ou manual)
   └── Gerar artifacts (concept.md, specs, PRPs)

3. Construcao
   ├── Criar workspace referenciando o projeto
   ├── Engine le artefatos do projeto como contexto
   └── Workflow executa waves ate o produto estar pronto

4. Evolucao
   ├── Novos sprints adicionam ao produto via novas waves
   └── Artefatos do projeto podem ser refinados entre waves
```

## Tags e organizacao

Tags no `project.json` permitem:

- Filtrar projetos por tipo (`product`, `library`, `experiment`)
- Agrupar por tecnologia (`frontend`, `backend`, `infra`)
- Marcar estagio (`v0`, `v1`, `mvp`)

A organizacao por tags eh complementar ao `status` — tags sao multivaloradas e permanentes, status eh singular e muda com o tempo.

## TASK.md

Arquivo opcional na raiz do projeto. Nao tem estrutura obrigatoria — eh um documento de uso livre do redator do projeto.

Sua finalidade eh instruir o agente sobre **o que fazer** nesta execucao especifica: descrever o objetivo da tarefa, contextualizar os artefatos disponiveis, apontar onde estao os materiais relevantes e explicar decisoes de design que o agente precisaria saber para nao tomar direcoes erradas.

O `TASK.md` complementa os artefatos do projeto (concept, specs, PRPs) com informacao situacional — o "briefing de missao" antes de uma wave. Enquanto os artefatos descrevem **o que** sera construido, o `TASK.md` diz **como abordar** esta execucao em particular: quais fontes consultar, quais restricoes respeitar, quais partes do produto ja existem.

Exemplos do que pode conter:

- Descricao do sprint ou etapa atual
- Mapa dos materiais de referencia disponíveis em `sources/` e o que cada um representa
- Restricoes tecnicas ou decisoes de arquitetura ja tomadas
- Instrucoes sobre o que **nao** fazer (evitar reescritas, manter compatibilidade, etc.)
- Contexto sobre o estado atual do codigo/produto

## Convencoes

- O slug deve ser lowercase, sem espacos (use hifens se necessario)
- O `concept.md` eh o primeiro artefato derivado — a visao geral do que sera construido
- Sources sao adicionados antes de gerar artifacts
- Artifacts sao consumidos pelo harness como input imutavel durante uma wave
- O projeto nao contem codigo — codigo vive no repo do workspace

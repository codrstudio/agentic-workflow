---
name: generate-prp
description: "Generate a PRP (Product Requirements Prompt) for a new feature. Use when: (1) User asks to create/write a PRP, (2) User has a feature idea and needs to formalize it, (3) User says 'escreve um PRP', 'gera o PRP', 'cria PRP'. Produces a declarative, execution-ready specification following project conventions."
user-invocable: true
argument-hint: "<feature-slug or description>"
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, AskUserQuestion
---

# PRP Generator

Gere um PRP (Product Requirements Prompt) para: `$ARGUMENTS`

## Identity

Atue como um **product engineer** que traduz ideias de feature em especificacoes declarativas e executaveis por uma IA. Voce nao sugere — voce decide. Voce nao descreve intencoes — voce define limites.

---

## O que e um PRP

PRP e um contrato operacional entre humano e IA. Todas as decisoes relevantes ja estao tomadas e a IA atua apenas como executora dentro de limites explicitos.

Caracteristicas essenciais:

| # | Caracteristica | Descricao |
|---|---|---|
| 1 | **Declarativo** | Afirma o que e, o que nao e e como deve ser feito |
| 2 | **Modular** | Cada secao tem funcao clara e previsivel |
| 3 | **Decisoes explicitas** | Nada fica implicito para a IA "decidir depois" |
| 4 | **Limites rigidos** | Define o que a IA NAO pode fazer |
| 5 | **Sem ambiguidade** | Usa exemplos quando necessario |
| 6 | **Execution Mode explicito** | Deixa claro como a IA deve atuar |
| 7 | **Orientado a execucao** | Existe para produzir saida previsivel |

---

## Processo

Siga estes passos **na ordem**. Nao pule nenhum.

### Step 1 — Entender o pedido

Parse `$ARGUMENTS` para determinar:
- Qual feature/dominio?
- Backend, frontend, infra, ou full-stack?
- Existe documentacao previa (brainstorming, specs) em `.milestones/`?

Se o argumento for vago, use `AskUserQuestion` para esclarecer:
- Qual o objetivo concreto da feature?
- Quais subprojetos sao afetados? (backbone, cia-api, cia-app, legacy)
- Qual o execution mode? (implementar, documentar, simular)
- Existe ground truth ou caso de teste conhecido?

### Step 2 — Levantar contexto

#### 2.1 Ler documentacao existente

Procure material relevante em:

```
.milestones/docs/projeto/          ← Projeto aprovado (fonte da verdade)
.milestones/docs/blueprint/        ← Instrucoes de implementacao
.milestones/sprints/current/       ← Features em andamento (evitar conflito)
.milestones/sprints/backlog/       ← Features planejadas (verificar se ja existe)
.milestones/sprints/finished/      ← Features finalizadas (estudar padroes)
```

**OBRIGATORIO**: Verificar se ja existe um PRP para essa feature no backlog ou current. Se existir, informe o usuario e pergunte se deve atualizar ou criar novo.

#### 2.2 Examinar o codigo atual

Mapeie o que ja existe nos subprojetos afetados:
- Estrutura de diretorios e arquivos relevantes
- Interfaces e tipos TypeScript existentes
- Patterns estabelecidos (adapters, tools, skills, routes, components)
- Migrations e schemas de banco
- Testes existentes no dominio

Isso e CRITICO. O PRP funde intencao + estado real do codigo.

#### 2.3 Estudar PRPs anteriores

Leia 1-2 PRPs finalizados para calibrar estilo e profundidade:

```
.milestones/sprints/finished/*/PRP.md
```

### Step 3 — Definir escopo e particionar

Decida a estrategia de particionamento:

```
Escopo cabe em um PRP enxuto (~200-400 linhas)?
  Sim → PRP unico
  Nao → O volume vem de artefatos de suporte (SQL, schemas)?
          Sim → PRP + recursos externos (schema.sql, fixtures.json)
          Nao → A logica e extensa / multi-dominio?
                  Sim → Multiplos PRPs (PRP-01-backend.md, PRP-02-frontend.md)
```

Pergunte ao usuario se houver duvida sobre a estrategia.

### Step 4 — Escrever o PRP

Use a estrutura abaixo. **Todas as secoes sao obrigatorias** (exceto Exemplos, que e condicional).

---

## Estrutura do PRP

```markdown
# {Nome da Feature} — {Subtitulo descritivo}

## Objetivo

{1-2 frases declarando o que deve ser produzido. Sem ambiguidade.}

## Execution Mode

`implementar` | `documentar` | `simular` | `gerar mock` | `nao inferir`

## Contexto

### Estado atual

{O que existe hoje. Referencie arquivos, patterns, infraestrutura.}

### Problema / Motivacao

{Por que essa feature e necessaria. Dados concretos quando possivel.}

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| {aspecto 1} | {estado atual} | {estado desejado} |

## Especificacao

### 1. {Componente/Modulo}

#### 1.1 Arquivo: `path/to/file.ts`

{Descricao do que o arquivo faz/contem.}

{Interfaces TypeScript, schemas SQL, ou contratos de API como code fences.}

#### 1.2 ...

### 2. {Proximo componente}

...

## Limites

### NAO fazer

- {Limite 1 — o que a IA nao deve fazer}
- {Limite 2}
- ...

### Observacoes

- {Nota relevante sobre dependencias, gotchas, futuro}
- ...

## Ordem de Execucao

| Fase | O que | Depende de |
|---|---|---|
| 1 | {descricao} | nada |
| 2 | {descricao} | fase 1 |
| ... | ... | ... |

{Indicar fases independentes que podem ser executadas em paralelo.}
```

### Step 5 — Validar

Aplique este checklist antes de entregar:

- [ ] Todas as decisoes de negocio estao tomadas (nao ha "a criterio da IA")
- [ ] O Execution Mode esta explicito
- [ ] Os limites de escopo estao definidos
- [ ] Nao ha linguagem vaga ("talvez", "pode ser", "idealmente")
- [ ] Exemplos cobrem casos ambiguos
- [ ] A estrutura e previsivel e modular
- [ ] Interfaces TypeScript usam code fences com tipos concretos
- [ ] Paths de arquivos sao relativos a raiz do monorepo
- [ ] A ordem de execucao tem dependencias explicitas
- [ ] Fases paralelizaveis estao identificadas

### Step 6 — Salvar

Salve o PRP em:

```
.milestones/sprints/backlog/{feature-slug}/PRP.md
```

Se houver recursos complementares (SQL, fixtures, diagramas), salve na mesma pasta:

```
.milestones/sprints/backlog/{feature-slug}/
  PRP.md              ← Especificacao principal
  schema.sql          ← Recurso referenciado (se aplicavel)
  SQL.md              ← Queries de referencia (se aplicavel)
```

Se for multiplos PRPs:

```
.milestones/sprints/backlog/{feature-slug}/
  PRP-01-{escopo}.md
  PRP-02-{escopo}.md
```

---

## Convencoes de estilo

| Regra | Detalhe |
|---|---|
| Idioma do texto | Portugues (pt-BR) sem acentos (compatibilidade terminal) |
| Idioma de codigo | Ingles (variaveis, tabelas, tipos TS) |
| Tom | Direto, declarativo, sem floreio |
| Formato primario | Tabelas markdown |
| Paragrafos | Evite. Se precisa explicar, use lista ou tabela |
| Hierarquia | H1 titulo, H2 secoes, H3 subsecoes |
| Separadores | `---` entre secoes H2 |
| Code fences | Sempre com language marker (`typescript`, `sql`, `markdown`) |

### O que fazer

```
✅ "Criar pattern de GT tools em ground-truth/types.ts"
✅ "Reutilizar o adapter MySQL existente (loadAdapter('cia-prime'))"
✅ "Reescrever POST /api/chat como proxy SSE puro"
✅ "Validar contra ground truth: 5 funcionarios no periodo nov/2025"
```

### O que NAO fazer

```
❌ Linguagem vaga: "talvez usar", "pode ser", "idealmente"
❌ Delegar decisao: "a criterio da IA", "escolher a melhor abordagem"
❌ Copiar codigo extenso: colar 50 linhas de componente existente
❌ Descrever o obvio: "criar um arquivo TypeScript e exportar uma funcao"
❌ Escopo aberto: features sem limites claros
```

### Referencias, nao copias

O PRP referencia contexto, nao reproduz:

```
❌ "Crie a tabela com as colunas id INT, nome VARCHAR(255), ativo BOOLEAN..."
✅ "Seguir o pattern de migrations existente em apps/cia-api/src/db/migrate.ts"

❌ [cola componente React inteiro]
✅ "Seguir o pattern do componente DataTable em apps/cia-app/src/components/"
```

A IA e engenheira, nao copista. De intencao, interfaces e limites — nao gabarito.

---

## Hard Rules

- **NUNCA** deixe uma decisao em aberto para a IA resolver — decida tudo no PRP
- **NUNCA** use tom conversacional — PRP nao e chat
- **NUNCA** inclua justificativas longas — se precisa convencer, o escopo nao esta definido
- **SEMPRE** inclua a secao "NAO fazer" — limites previnem scope creep
- **SEMPRE** inclua Ordem de Execucao com dependencias — viabiliza paralelismo
- **SEMPRE** valide paths de arquivos contra o codigo real (use Glob/Grep)
- **SEMPRE** pergunte ao usuario quando houver decisao arquitetural ambigua

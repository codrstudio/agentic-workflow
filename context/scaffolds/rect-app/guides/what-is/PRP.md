# PRP — Product Requirements Prompt

Um artefato declarativo de especificação escrito para orientar a execução autônoma de uma IA.

## O que é

PRP é o equivalente operacional de um Product Requirements Document, porém otimizado para modelos de linguagem, não para humanos.

Ele não descreve intenções vagas nem ideias em aberto. Ele define limites, decisões e forma de execução.

**Definição curta:** PRP é um contrato operacional entre humano e IA, onde todas as decisões relevantes já estão tomadas e a IA atua apenas como executora dentro de limites explícitos.

## Características essenciais

| # | Característica | Descrição |
|---|----------------|-----------|
| 1 | **Declarativo** | Afirma o que é, o que não é e como deve ser feito. Não é conversacional. |
| 2 | **Modular** | Cada seção tem função clara e previsível. Estrutura padronizada. |
| 3 | **Decisões explícitas** | Nada fica implícito para a IA "decidir depois". |
| 4 | **Limites rígidos** | Define o que a IA não pode fazer. |
| 5 | **Sem ambiguidade** | Usa exemplos quando necessário para evitar interpretações livres. |
| 6 | **Execution Mode** | Deixa claro como a IA deve atuar. |
| 7 | **Orientado à execução** | Existe para produzir saída previsível, não para discussão. |

## Execution Modes

O PRP deve declarar explicitamente o modo de execução esperado:

- `implementar` — gerar código/artefato funcional
- `documentar` — apenas descrever sem implementar
- `simular` — executar dry-run ou walkthrough
- `gerar mock` — criar versão simplificada/placeholder
- `não inferir` — seguir estritamente o descrito, sem extrapolar

## O que um PRP não é

- Não é um prompt criativo
- Não é um brainstorm
- Não é uma conversa
- Não é um manifesto
- Não delega decisões estratégicas à IA

## Estrutura sugerida

```markdown
# [Nome do PRP]

## Objetivo
[O que deve ser produzido]

## Execution Mode
[implementar | documentar | simular | gerar mock | não inferir]

## Contexto
[Estado atual, inputs disponíveis]

## Especificação
[Requisitos detalhados, regras, formato esperado]

## Limites
[O que a IA NÃO deve fazer]

## Exemplos
[Input/Output esperado, se necessário]
```

## Checklist de validação

Um PRP está bem escrito se:

- [ ] Todas as decisões de negócio estão tomadas (não há "a critério da IA")
- [ ] O Execution Mode está explícito
- [ ] Os limites de escopo estão definidos
- [ ] Não há linguagem vaga ("talvez", "pode ser", "idealmente")
- [ ] Exemplos cobrem casos ambíguos
- [ ] A estrutura é previsível e modular
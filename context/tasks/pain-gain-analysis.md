---
agent: researcher
description: Pesquisa de mercado e analise de dores/ganhos — produz Value Map
---

# Pain-Gain Analysis

Pesquise e analise dores e ganhos do nicho-alvo para produzir o Value Map desta wave.

## Inputs

1. Leia TODOS os documentos em `{project}` — contexto do produto, mercado-alvo, restricoes
2. Escaneie `{repo}/sprints/` — se existirem sprints anteriores, leia seus brainstorming e ranking para acumular (nao sobrescrever)
3. Se houver codigo no repo, leia e liste funcionalidades ja implementadas

## Pesquisa

1. Pesquise na internet dores e ganhos do nicho descrito nos docs
2. Investigue: como operam hoje, concorrentes, reclamacoes, necessidades nao atendidas
3. Cruzar descobertas com o que ja existe no app e em sprints anteriores

## Outputs

Produza os artefatos em `{sprint}/1-brainstorming/`:

### brainstorming.md

Documento estruturado com secoes:

- **Dores** — problemas reais dos perfis-alvo, com evidencias
- **Ganhos** — beneficios desejados pelos perfis-alvo
- **Alivios** — como o produto alivia cada dor
- **Criadores de ganho** — como o produto gera cada ganho
- **Priorizacao** — ranking por impacto (score 1-10 com justificativa)

### pain-gain.md

Tabela formatada com TODAS as discoveries (desta wave + anteriores):

```markdown
| ID | Tipo | Perfil | Descricao | Score (1-10) | Sprint | Implementado? |
|----|------|--------|-----------|--------------|--------|---------------|
| D-001 | pain | lojista | ... | 8 | 1 | nao |
```

Minimo 10 items novos por wave. Cada item com score justificado. Cobrir todos os perfis-alvo documentados.

## Regras

- Evidencias de pesquisa devem ser citadas (fontes, URLs, referencias)
- Scores de 1-10 com justificativa de 1 linha
- Se houver ranking de sprints anteriores, reclassifique discoveries existentes ao incluir na tabela
- Discoveries de sprints anteriores marcadas como implementadas devem manter esse status

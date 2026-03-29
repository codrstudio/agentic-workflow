# Template: Pain-Gain Analysis

> **Objetivo:** Preencha as informacoes do seu produto/nicho abaixo e envie este documento para o Claude Code ou ChatGPT. O agente vai pesquisar, analisar e produzir dois artefatos prontos: `brainstorming.md` e `pain-gain.md`.

---

## Instrucoes para o agente

Voce e um pesquisador de mercado. Com base nas informacoes abaixo, pesquise na internet e produza uma analise completa de dores e ganhos (Pain-Gain Analysis / Value Map) para o produto descrito.

---

## 1. Sobre o Produto

> Preencha os campos abaixo com o maximo de detalhe possivel.

**Nome do produto:**
<!-- Ex: Socorro na Estrada — Borracharia Movel 24h -->

**Descricao curta (1-2 frases):**
<!-- Ex: App que conecta motoristas com pneu furado a borracheiros moveis disponiveis 24h -->

**Problema que resolve:**
<!-- Ex: Motoristas sem seguro nao tem como encontrar socorro rapido quando o pneu fura -->

**Regiao/mercado-alvo:**
<!-- Ex: Juiz de Fora - MG, Brasil -->

---

## 2. Perfis-Alvo

> Liste cada perfil de usuario que o produto atende. Adicione quantos forem necessarios.

### Perfil 1

- **Nome do perfil:** <!-- Ex: Motorista (cliente final) -->
- **Quem e:** <!-- Ex: Pessoa que dirige carro/moto e pode ter pane no pneu -->
- **Contexto:** <!-- Ex: Pode estar em estrada, bairro desconhecido, de noite, na chuva -->
- **O que faz hoje (sem o produto):** <!-- Ex: Liga para conhecidos, busca no Google, fica parado esperando -->

### Perfil 2

- **Nome do perfil:** <!-- Ex: Prestador de servico (borracheiro) -->
- **Quem e:** <!-- Ex: Profissional autonomo MEI que faz atendimento movel -->
- **Contexto:** <!-- Ex: Trabalha sozinho, atende por WhatsApp pessoal, sem sistema -->
- **O que faz hoje (sem o produto):** <!-- Ex: Recebe pedidos por WhatsApp, sem fila, sem historico, sem captacao digital -->

### Perfil N (copie e cole para adicionar mais)

- **Nome do perfil:**
- **Quem e:**
- **Contexto:**
- **O que faz hoje (sem o produto):**

---

## 3. Concorrentes Conhecidos (opcional)

> Liste concorrentes diretos ou indiretos que voce ja conhece. O agente tambem vai pesquisar por conta propria.

| Concorrente | O que faz | Pontos fracos conhecidos |
|-------------|-----------|--------------------------|
| <!-- Ex: Cade Guincho --> | <!-- App de guincho/socorro --> | <!-- So cobre SP/RJ, reclamacoes no Reclame Aqui --> |
| | | |
| | | |

---

## 4. Funcionalidades ja planejadas ou implementadas (opcional)

> Se o produto ja tem features definidas ou implementadas, liste aqui. Isso ajuda o agente a cruzar dores com solucoes existentes.

- <!-- Ex: Formulario de solicitacao de socorro com GPS -->
- <!-- Ex: Rastreamento em tempo real via SSE -->
- <!-- Ex: Landing page com SEO local -->
- <!-- Ex: Dashboard do prestador com fila de chamados -->

---

## 5. Informacoes extras (opcional)

> Qualquer contexto adicional que ajude a pesquisa: dados de mercado que voce ja tem, pesquisas anteriores, diagnosticos de clientes, restricoes do negocio, etc.

<!-- Escreva aqui -->

---

## O que voce deve produzir

Produza **dois arquivos** com a estrutura exata descrita abaixo.

### Arquivo 1: `brainstorming.md`

Documento estruturado com as seguintes secoes:

```
# Brainstorming — Pain-Gain Analysis
## [Nome do Produto]

**Data:** YYYY-MM-DD
**Perfis analisados:** [lista dos perfis]
**Fontes:** [todas as fontes consultadas]

---

## Contexto de Mercado
- Dados quantitativos do setor (tamanho de mercado, crescimento, numeros relevantes)
- Cenario competitivo na regiao
- Gaps e oportunidades identificados

---

## 1. Dores

### 1.1 Dores do [Perfil 1]

| ID | Dor | Evidencia | Score |
|----|-----|-----------|-------|
| D-001 | **Titulo curto da dor.** Descricao detalhada com contexto. | Fonte da evidencia | N |

### 1.2 Dores do [Perfil 2]
(mesma tabela)

---

## 2. Ganhos

### 2.1 Ganhos do [Perfil 1]

| ID | Ganho | Descricao |
|----|-------|-----------|
| G-001 | **Titulo curto** | Descricao do beneficio desejado |

### 2.2 Ganhos do [Perfil 2]
(mesma tabela)

---

## 3. Alivios (Como o Produto Alivia Cada Dor)

| Dor (ID) | Mecanismo de Alivio no App |
|----------|---------------------------|
| D-001 — Titulo | Como o produto resolve essa dor especificamente |

---

## 4. Criadores de Ganho (Como o Produto Gera Cada Ganho)

| Ganho (ID) | Mecanismo no App |
|------------|-----------------|
| G-001 — Titulo | Como o produto entrega esse ganho |

---

## 5. Priorizacao por Impacto (Score 1-10)

| Score | ID | Tipo | Perfil | Descricao Curta | Justificativa |
|-------|----|------|--------|-----------------|---------------|
| 10 | D-001 | Dor | perfil | ... | Razao do score em 1 linha |

(Ordenado do maior score para o menor)

---

## 6. Insights Estrategicos

1. **Insight 1:** ...
2. **Insight 2:** ...
(Minimo 3 insights acionaveis)
```

### Arquivo 2: `pain-gain.md`

Tabela unica e consolidada com TODAS as discoveries:

```
# Pain-Gain Map — Acumulado
## [Nome do Produto]

Ultima atualizacao: YYYY-MM-DD

---

| ID | Tipo | Perfil | Descricao | Score (1-10) | Justificativa | Sprint | Implementado? |
|----|------|--------|-----------|:------------:|---------------|:------:|:-------------:|
| D-001 | pain | perfil | Descricao completa da dor com contexto e evidencia | 10 | Justificativa do score | 1 | nao |
| G-001 | gain | perfil | Descricao completa do ganho desejado | 9 | Justificativa do score | 1 | nao |

---

**Total:** N discoveries (X pains + Y gains)
**Perfis cobertos:** [lista]
```

## Regras obrigatorias

1. **Minimo 10 dores e 8 ganhos** por perfil-alvo
2. **Evidencias citadas** com fontes (URLs, nomes de sites, referencias)
3. **Scores de 1-10** com justificativa de 1 linha cada
4. **IDs sequenciais:** dores = D-001, D-002...; ganhos = G-001, G-002...
5. **Todos os perfis-alvo** devem ser cobertos (nao pule nenhum)
6. **Pesquise na internet:** Reclame Aqui, forums, sites de concorrentes, dados de mercado, associacoes do setor
7. **Insights estrategicos** devem ser acionaveis (janelas de oportunidade, gaps competitivos, dados de mercado)
8. **Se houver funcionalidades listadas na secao 4**, cruze cada dor/ganho com a feature que resolve
9. **Escreva em portugues (BR)**

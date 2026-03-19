# Insights: Análise de Qualidade do Processo Claude Code

**Projeto**: socorro-24h | **Run**: run-1-standard-vibe-full-app | **Wave**: 1
**Período**: 2026-03-17 07:44 → 2026-03-18 01:36 (~18h wall-clock, ~7.2h CPU ativo)
**Total de spawns**: 61 | **Features implementadas**: 47 (37 sprint-1 + 10 sprint-2)
**Modelo**: claude-sonnet-4-6

---

## 1. Resumo Executivo

| Métrica | Valor |
|---------|-------|
| Duração total (soma dos spawns) | 434 min (~7.2h) |
| Input tokens | 355,297 |
| Output tokens | 36,006 |
| Cache creation tokens | 7,839,571 |
| Cache read tokens | 134,616,537 |
| Cache hit ratio | 94.5% |
| Tool calls totais | 2,195 |
| Timeouts | 1 (step-01 attempt-1, 26m) |
| Crashes (0xC0000409) | 2 (step-05 attempts 2-3) |
| Taxa de sucesso first-attempt | 85% (52/61) |

---

## 2. Timeline de Execução

### Sprint 1 (07:44 → 13:23 = 5h39m)

```
07:44  go-no-go             2.8m   ✓
07:47  derive-specs          9.0m   ✓
07:56  derive-prps           4.4m   ✓
08:00  plan-features         5.4m   ✓
08:06  F-001 scaffolding     3.7m   ✓
08:10  F-002 db schema       4.6m   ✓
08:14  F-004 docker          6.8m   ✓
08:21  F-005 config          3.3m   ✓
08:25  F-003 migrations     15.4m   ✓  ← 3x média
08:40  F-006 types stubs     4.9m   ✓
08:45  F-007 core stub       4.0m   ✓
08:49  F-008 core chamados   6.6m   ✓
08:56  F-009 core full      59.5m   ✓  ← OUTLIER (10x média)
09:56  F-010 validators      3.1m   ✓
09:59  F-011 api setup       9.6m   ✓
10:08  F-012 api pública     6.6m   ✓
10:15  F-013 api auth       11.2m   ✓
10:26  F-014 api services    9.5m   ✓
10:36  F-015 api SSE         6.2m   ✓
10:42  F-016 Next.js setup  25.7m   ✓  ← 4x média
11:08  F-028 hub auth        7.2m   ✓
11:15  F-017 hero section    3.3m   ✓
11:19  F-019 mapa+contato    6.3m   ✓
11:25  F-018 serviços        3.7m   ✓
11:29  F-020 SEO             4.9m   ✓
11:34  F-021 form step1      4.8m   ✓
11:39  F-022 form step2      3.6m   ✓
11:42  F-023 form step3      5.8m   ✓
11:48  F-024 confirmação     5.5m   ✓
11:54  F-025 tracking        6.6m   ✓
12:00  F-026 SSE realtime   10.0m   ✓
12:10  F-027 rating          6.7m   ✓
12:17  F-029 dashboard       5.2m   ✓
12:22  F-030 chamados SSE    4.4m   ✓
12:27  F-031 status trans.   7.0m   ✓
12:34  F-032 concluir/canc.  4.6m   ✓
12:39  F-033 PWA layout     17.1m   ✓  ← 3x média
12:56  F-034 histórico       6.0m   ✓
13:02  F-035 hist. paginada  0.0m   ✗  exit=None
13:12  F-036 config dados    3.4m   ✓
13:15  F-037 tabela preços   7.3m   ✓
13:23  merge-worktree        3.2m   ✓  (1 attempt falho → retry ok)
```

### Sprint 2 (23:50 → 01:36 = 1h46m)

```
23:50  pain-gain-analysis   26.1m   ✗  TIMEOUT → retry 9.8m ✓
00:26  go-no-go              2.5m   ✓
00:29  derive-specs          8.8m   ✓
00:37  derive-prps           6.6m   ✓
00:44  plan-features         0.4m   ✗  CRASH → 0.2m ✗ CRASH → 7.1m ✓
00:52  F-052 → F-066        51.4m   ✓  (10 features, 5.1m média)
01:36  F-054                  0.0m   ✗  exit=None
```

---

## 3. Uso de Ferramentas

### Distribuição

| Tool | Calls | % | Observação |
|------|-------|---|------------|
| **Bash** | **1,252** | **57%** | Excessivo — ver análise abaixo |
| Read | 371 | 17% | OK |
| Write | 196 | 9% | OK |
| Edit | 169 | 8% | OK |
| TodoWrite | 84 | 4% | Tracking interno |
| Glob | 33 | 2% | Subutilizado |
| WebSearch | 31 | 1% | Apenas no step-01 |
| WebFetch | 22 | 1% | Apenas no step-01 |
| ToolSearch | 20 | 1% | Overhead de bootstrap |
| StructuredOutput | 10 | 0.5% | |
| Grep | **1** | **0%** | Praticamente não usado |

### Análise do Abuso de Bash (1,252 calls)

| Categoria | Calls | % | Deveria usar |
|-----------|-------|---|-------------|
| `cat/head/tail` | 302 | 24% | **Read** |
| `cd/pwd` | 288 | 23% | Desnecessário |
| `find/ls` | 212 | 17% | **Glob** |
| `npm/node/npx` | 144 | 12% | Legítimo |
| `python3` | 33 | 3% | Legítimo (data processing) |
| `git` | 102 | 8% | Legítimo |
| `grep/rg` | 38 | 3% | **Grep** |
| `echo/printf` | 31 | 2% | **Write** |
| `docker` | 14 | 1% | Legítimo |
| `curl` (API tests) | 14 | 1% | Legítimo |
| `sed/awk` | 5 | 0% | **Edit** |
| Outros | 69 | 6% | Misto |

**588 calls (47%) poderiam ser substituídas por ferramentas dedicadas** (Read, Glob, Grep, Write, Edit). As 288 chamadas de `cd/pwd` são puro overhead — o agente navega por diretórios quando deveria usar caminhos absolutos.

---

## 4. Problemas Identificados

### 4.1 Outlier F-009: 59.5 minutos (10x a média)

A feature "Core — ratings, services, settings, dashboard" levou 59.5m (média geral: 6m). Análise dos tool calls:
- Leu 8 arquivos antes de começar a escrever
- Rodou `npm run typecheck` → encontrou erros → corrigiu → re-rodou
- Executou testes com `node --import tsx/esm` para validar queries ao DB
- Spawnou subagente para testar filtros
- Atualizou `features.json` manualmente via `python3` + `cat >>`

**Root cause**: Feature muito ampla (4 módulos: ratings, services, settings, dashboard). Se fosse decomposta em 4 features separadas, cada uma levaria ~8-10 min ao invés de 59.5.

### 4.2 Outlier F-016: 25.7 minutos (4x a média)

"Setup Next.js + layout base" — 118 tool calls (3x a média de 39). O agente provavelmente configurou o projeto Next.js do zero incluindo layout, tema, e múltiplos arquivos de configuração. Features de scaffolding de framework tendem a ser mais lentas.

### 4.3 Crashes do CLI (exit 0xC0000409)

Step-05 (plan-features) crashou 2 vezes consecutivas com `STATUS_STACK_BUFFER_OVERRUN`:
- Attempt 2: 22 segundos → crash
- Attempt 3: 13 segundos → crash
- Attempt 4: success (7.1m)

Provável causa: pico de memória na máquina ou bug no runtime do Claude CLI. O retry automático da engine recuperou corretamente.

### 4.4 Spawns com exit=None (F-035, F-054)

Duas features tiveram `exit=None` e `duration=0.0m`:
- **F-035** (Histórico lista paginada) — sem finished_at registrado
- **F-054** — idem

Possível causa: processo morto pelo OS ou pelo engine sem tempo de registrar o exit code. O engine não re-tentou essas features.

### 4.5 Timeout no Pain-Gain Analysis (26m)

Step-01 attempt-1 esgotou o timeout de 26 minutos gastando 57,102 tokens em pesquisa web. O retry (attempt-2) completou em 9.8m com 11,242 tokens. O primeiro attempt provavelmente ficou preso em um loop de `WebSearch → WebFetch → WebSearch` tentando ser exaustivo.

---

## 5. Erros por Categoria (147 tool errors total)

| Padrão | Ocorrências | Impacto |
|--------|-------------|---------|
| Exit code 1 (python/node scripts) | 37 | Médio — agente tenta executar scripts antes de verificar deps |
| File/command not found | 20 | Baixo — agente tenta ler arquivos que ainda não existem |
| "File has not been read yet" (Write guard) | 16 | Baixo — agente tenta Write sem Read prévio, o guard funciona |
| Parallel tool call cancelled | 17 | Baixo — tool calls cancelados quando outro da mesma batch falha |
| Node module errors | 11 | Médio — import errors por dependência faltando |
| HTTP 403 (web fetch blocked) | 3 | Baixo — sites que bloqueiam scraping |
| .gitignore rejection | 3 | Baixo — agente tenta adicionar arquivos ignorados |
| Typecheck failures | 2 | Baixo — erros TS corrigidos na iteração seguinte |
| Other | 38 | Variado |

**Taxa de erro**: 147 erros / 2,195 tool calls = **6.7%**. Aceitável para um fluxo autônomo, mas há espaço para redução.

---

## 6. Token Economics

| Métrica | Valor |
|---------|-------|
| Input tokens (direto) | 355,297 |
| Output tokens | 36,006 |
| Cache creation | 7,839,571 |
| Cache read | 134,616,537 |
| **Cache hit ratio** | **94.5%** |
| Tokens desperdiçados (timeout) | 57,102 |
| Tokens desperdiçados (crashes) | 20 |
| Ratio output/input | 10.1% |

O cache hit ratio de 94.5% é excelente — as features dentro do ralph-wiggum loop compartilham o mesmo prefixo de prompt (CLAUDE.md + task template), então o cache é muito bem aproveitado.

O ratio output/input de 10.1% indica que o agente lê muito mais do que escreve — esperado para um fluxo de codificação onde cada resposta consome o system prompt + contexto acumulado.

---

## 7. Métricas de Performance

| Métrica | Valor |
|---------|-------|
| Throughput output | 83 tokens/min |
| Tool calls/min | 5.1 |
| Duração média por feature | 6.7 min |
| Duração mediana por feature | 5.5 min |
| Features/hora (incluindo prep steps) | ~6.5 |

---

## 8. Recomendações Prioritárias

### P0 — Impacto Alto, Esforço Baixo

1. **Instruir o agente a usar ferramentas dedicadas ao invés de Bash**
   - Adicionar ao CLAUDE.md do worktree: "Use Read ao invés de cat, Glob ao invés de find/ls, Grep ao invés de grep"
   - **Impacto estimado**: -20% nos tool calls, -15% no tempo (menos overhead de shell spawn)
   - **588 Bash calls eliminadas**, particularmente as 288 de cd/pwd que são puro desperdício

2. **Eliminar `cd/pwd` como primeiro command**
   - O agente executa `pwd` em quase todo spawn e navega por `cd` repetidamente
   - Instruir: "Seu cwd já está configurado no worktree. Use caminhos absolutos ou relativos, nunca cd."

3. **Decompor features que cobrem múltiplos módulos**
   - F-009 (4 módulos em 1 feature) levou 59.5m = quase o mesmo que 10 features normais
   - Regra: uma feature não deve tocar mais que 2 pacotes/módulos distintos

### P1 — Impacto Alto, Esforço Médio

4. **Timeout adaptativo por step type**
   - `pain-gain-analysis` (pesquisa web): 15m (não 26m) com instrução de ser direto
   - `plan-features`: 10m
   - `vibe-code` (features): 20m (suficiente para 99% das features)
   - Evita spawns longos e improdutivos

5. **Investigar spawns com exit=None**
   - F-035 e F-054 foram silenciosamente abandonadas sem retry
   - A engine deveria detectar `exit=None` como falha e re-tentar

6. **Reduzir scope de leitura nas features**
   - O agente lê o repo inteiro antes de cada feature. Injetar no prompt apenas os arquivos relevantes (derivados do PRP/spec) economizaria tokens e tempo.

### P2 — Impacto Médio, Esforço Alto

7. **Paralelizar features independentes**
   - Features sem dependência entre si (ex: F-017, F-018, F-019 são todas páginas independentes) poderiam rodar em paralelo
   - Requer controle de git conflicts no worktree, mas economizaria tempo significativo

8. **Injetar contexto de erros anteriores no retry**
   - Quando o step-01 fez timeout e retentou, o retry partiu do zero
   - Passar um resumo do que o attempt anterior já descobriu evitaria refazer o trabalho

9. **Grep — praticamente não usado (1 call em 61 spawns)**
   - O agente usa `grep` via Bash (38 vezes) ao invés da tool dedicada Grep
   - Grep nativo é mais eficiente, retorna resultados formatados e respeita permissões

---

## 9. Padrões Positivos a Manter

1. **Cache hit ratio de 94.5%** — o design de prompts compartilhados está funcionando muito bem
2. **Taxa de sucesso de 100% nas features** (exceto as 2 com exit=None) — zero retries no ralph-wiggum loop
3. **Duração consistente** — 80% das features ficaram entre 3-10 minutos
4. **Recovery automático** — crashes e timeouts foram recuperados pelo retry da engine
5. **Commit discipline** — cada feature faz commit ao final (visto no F-009: `git add` + `git commit`)
6. **Uso de TypeScript typecheck** como validação — reduz bugs silenciosos

---

## 10. Estimativa de Ganho

Se as recomendações P0 forem implementadas:

| Antes | Depois (estimado) |
|-------|--------------------|
| 434 min total | ~350 min (-20%) |
| 2,195 tool calls | ~1,600 (-27%) |
| 6.7 min/feature avg | ~5.5 min/feature |
| F-009 outlier 59.5m | ~4x8m = 32m |

Ganho esperado: **~1h20m** por wave, ou **~80 min por run**. Com waves múltiplas, o ganho acumula.

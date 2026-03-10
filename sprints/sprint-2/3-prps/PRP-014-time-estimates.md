# PRP-014 — Estimativas de Tempo e Progresso Projetado

**Specs:** S-019
**Prioridade:** 5 (nice-to-have de alta utilidade operacional)
**Dependências:** nenhuma

## Objetivo

Exibir tempo decorrido por step, tempo total da wave e estimativa de conclusão baseada na velocidade média dos steps concluídos. Dados já disponíveis em `spawn.json` (`started_at`, `finished_at`).

## Escopo

### Backend (apps/server)

- Enriquecer resposta de `GET /api/v1/projects/:slug/waves/:waveNumber` com objeto `timing`
- Função `computeTiming()` que calcula elapsed, média, estimativa a partir dos steps

### Frontend (apps/web)

- Seção de timing no wave detail: decorrido, média por step, tempo restante estimado, hora de conclusão
- Step `running` exibe tempo decorrido atualizado periodicamente (setInterval 10s)

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-038 | Wave Timing Backend | Função `computeTiming(steps)` em `routes/waves.ts` que calcula: `started_at` (do primeiro step), `elapsed_ms`, `completed_steps_avg_ms`, `completed_steps_total_ms`, `remaining_steps`, `estimated_remaining_ms`, `estimated_completion`. Retornar `null` quando não há steps concluídos. Incluir objeto `timing` na resposta de `GET /waves/:waveNumber`. |
| F-039 | Wave Timing Frontend | Seção de timing em `wave-detail.tsx` abaixo do progress bar: tempo decorrido total (formatDuration), média por step, "~Xm restantes" com opacidade reduzida, hora prevista `HH:MM`. Quando não há steps concluídos, exibir apenas decorrido. Step `running` na timeline exibe tempo decorrido em tempo real via `setInterval` 10s. Layout responsivo mobile. |

## Limites

- NÃO implementa estimativa baseada em histórico de waves anteriores (apenas steps da wave atual)
- NÃO persiste dados de timing — cálculo sob demanda na API
- NÃO implementa alertas de timeout/travamento baseados na estimativa

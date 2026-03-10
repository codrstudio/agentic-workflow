# S-019 — Estimativas de Tempo e Progresso Projetado

**Discoveries:** D-023 (score 5)

## Objetivo

Na wave timeline, exibir tempo decorrido por step, tempo total da wave e estimativa de conclusão baseada na velocidade média dos steps anteriores. Dados já disponíveis em `spawn.json` (`started_at`, `finished_at`).

## Escopo

### Backend (apps/server)

- Enriquecer resposta de `GET /api/v1/projects/:slug/waves/:waveNumber` com campos de tempo agregado

### Frontend (apps/web)

- Exibir métricas de tempo na wave timeline
- Calcular e exibir estimativa de conclusão

## Alterações no Backend

### `apps/server/src/routes/waves.ts`

Adicionar campos à resposta de `GET /waves/:waveNumber`:

```typescript
{
  wave_number: 1,
  status: "running",
  // ... campos existentes ...
  timing: {
    started_at: "2026-03-10T12:00:00Z",     // started_at do primeiro step
    elapsed_ms: 1800000,                      // tempo desde o início da wave
    completed_steps_avg_ms: 300000,           // média de duração dos steps concluídos
    completed_steps_total_ms: 1500000,        // soma da duração dos steps concluídos
    remaining_steps: 3,                        // steps pendentes + running
    estimated_remaining_ms: 900000,           // remaining_steps × completed_steps_avg_ms
    estimated_completion: "2026-03-10T12:45:00Z" // now + estimated_remaining_ms
  }
}
```

#### Lógica de cálculo

```typescript
function computeTiming(steps: StepSummary[]): WaveTiming | null {
  const completedSteps = steps.filter(s => s.status === 'completed' && s.duration_ms)
  if (completedSteps.length === 0) return null

  const firstStep = steps.find(s => s.started_at)
  if (!firstStep?.started_at) return null

  const startedAt = firstStep.started_at
  const elapsedMs = Date.now() - new Date(startedAt).getTime()

  const totalMs = completedSteps.reduce((sum, s) => sum + (s.duration_ms ?? 0), 0)
  const avgMs = Math.round(totalMs / completedSteps.length)

  const remainingSteps = steps.filter(s => s.status === 'pending' || s.status === 'running').length
  const estimatedRemainingMs = remainingSteps * avgMs
  const estimatedCompletion = new Date(Date.now() + estimatedRemainingMs).toISOString()

  return {
    started_at: startedAt,
    elapsed_ms: elapsedMs,
    completed_steps_avg_ms: avgMs,
    completed_steps_total_ms: totalMs,
    remaining_steps: remainingSteps,
    estimated_remaining_ms: estimatedRemainingMs,
    estimated_completion: estimatedCompletion,
  }
}
```

## Alterações no Frontend

### `apps/web/src/pages/wave-detail.tsx`

Adicionar seção de timing abaixo do progress bar:

```
┌─────────────────────────────────────┐
│ Wave 1                              │
│ 3/6 steps concluídos                │
│                                     │
│ ████████░░░░░░░░░  50%              │
│                                     │
│ ⏱ Decorrido: 30m                   │
│ ⏱ Média por step: 10m              │
│ ⏱ Estimativa: ~30m restantes       │
│   Conclusão prevista: 12:45         │
│                                     │
│ Timeline:                           │
│ ...                                 │
└─────────────────────────────────────┘
```

#### Formatação

- Tempo decorrido: `formatDuration()` já existente
- Estimativa: "~Xm restantes" com `~` indicando aproximação
- Hora prevista de conclusão: formato `HH:MM` local
- Quando não há steps concluídos: exibir apenas tempo decorrido, sem estimativa
- Estimativa deve ter opacidade/cor reduzida para indicar que é projeção

#### Duração por step na timeline

Cada step na timeline já exibe duração quando concluído. Adicionalmente:
- Step `running`: exibir tempo decorrido em tempo real (atualizar a cada 10s via `setInterval`)
- Step `pending`: sem indicação de tempo

## Critérios de Aceite

1. API retorna objeto `timing` com campos de tempo na resposta de `GET /waves/:waveNumber`
2. Wave detail exibe tempo decorrido total da wave
3. Wave detail exibe média de duração por step concluído
4. Wave detail exibe estimativa de tempo restante quando há pelo menos 1 step concluído
5. Wave detail exibe hora prevista de conclusão
6. Step `running` exibe tempo decorrido atualizado periodicamente
7. Quando não há steps concluídos, estimativa não é exibida (apenas decorrido)
8. Estimativa é visualmente distinta (opacidade reduzida) para indicar projeção
9. Funciona em mobile

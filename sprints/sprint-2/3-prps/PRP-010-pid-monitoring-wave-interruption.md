# PRP-010 — PID Monitoring & Detecção de Wave Interrompida

**Specs:** S-013, S-014
**Prioridade:** 1 (infraestrutura para detecção de estado real dos processos)
**Dependências:** nenhuma

## Objetivo

Implementar verificação de PID no server e usar essa infraestrutura para detectar waves/steps interrompidos. Resolve o bug de UX onde a wave exibe status "running" quando o processo já foi morto externamente. Entrega o endpoint de PID check (S-013) e a lógica de detecção de interrupção com visual correspondente (S-014).

## Escopo

### Backend (apps/server)

- Utility `isPidAlive()` usando `process.kill(pid, 0)`
- `GET /api/v1/pid/:pid/alive` — verifica se um PID está ativo no SO
- `GET /api/v1/runs/active` — lista runs com status `running`, enriquecidos com campo `alive`
- Novo status `interrupted` no `StepStatus` type
- `deriveStatus()` em `routes/waves.ts` cruza PID com SO para detectar interrupção

### Frontend (apps/web)

- Estado visual `interrupted` na wave timeline (ícone `AlertTriangle`, cor amber)
- Texto "Interrompido" no lugar de "em execução" para steps com PID morto

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-028 | PID Check Utility & Endpoints | Criar `apps/server/src/lib/pid-check.ts` com `isPidAlive()`. Adicionar rota `GET /api/v1/pid/:pid/alive`. Adicionar `GET /api/v1/runs/active` que lista runs running com campo `alive`. Validação: PID não numérico retorna 400. |
| F-029 | Wave Interruption Detection Backend | Adicionar `'interrupted'` ao tipo `StepStatus` em `routes/waves.ts`. Alterar `deriveStatus()` para checar PID via `isPidAlive()` quando spawn.json existe sem exit_code. Aplicar mesma lógica em loop steps via `loop.json.pid`. Wave status reflete estado interrupted. |
| F-030 | Wave Interruption Detection Frontend | Adicionar estado visual `interrupted` em `pages/wave-detail.tsx`: ícone `AlertTriangle` amber-500, texto "Interrompido", tooltip explicativo. Aplicar fundo `bg-amber-500/10 border-amber-500/30` no step da timeline. |

## Limites

- NÃO implementa detecção de travamento por timeout (apenas PID morto sem exit_code)
- NÃO implementa monitoramento contínuo de PIDs (é verificação sob demanda na API)
- NÃO altera o flow de spawn da engine — apenas a camada de leitura/visualização

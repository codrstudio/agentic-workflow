# S-013 — PID Monitoring Endpoint

**Discoveries:** D-021 (score 6)

## Objetivo

Expor um endpoint no server que verifica se um PID específico está ativo no sistema operacional. Essa infraestrutura é pré-requisito para detecção de wave/step interrompido (S-014) e para qualquer componente que precise saber se um processo da engine ainda está rodando.

## Escopo

### Backend (apps/server)

- Novo endpoint REST para verificar se um PID está vivo
- Utiliza `process.kill(pid, 0)` para checar existência do processo sem enviar sinal
- Também consulta o mapa de runs em memória (`runs Map`) para cruzar com estado interno

## API Endpoints

### `GET /api/v1/pid/:pid/alive`

Verifica se o processo com o PID informado está ativo no SO.

**Response 200:**
```json
{
  "pid": 12345,
  "alive": true
}
```

**Response 200 (processo morto):**
```json
{
  "pid": 12345,
  "alive": false
}
```

### `GET /api/v1/runs/active`

Retorna todos os runs com status `running`, incluindo verificação de PID alive para cada um. Permite que o frontend saiba quais processos da engine estão realmente ativos.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "slug": "aw-monitor-milestone-2",
    "workflow": "vibe-app",
    "pid": 12345,
    "status": "running",
    "alive": true,
    "startedAt": "2026-03-10T12:00:00Z"
  }
]
```

## Implementação

### Novo arquivo: `apps/server/src/lib/pid-check.ts`

```typescript
export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
```

### Alteração: `apps/server/src/routes/runs.ts`

- Importar `isPidAlive` de `../lib/pid-check.js`
- Adicionar rota `GET /active` que filtra runs com `status === 'running'` e enriquece com campo `alive`
- Exportar o mapa de runs (ou expor uma função `getActiveRuns()`) para uso por outros módulos

### Novo arquivo de rota ou adição em health.ts

- Adicionar rota `GET /api/v1/pid/:pid/alive` que recebe um PID numérico e retorna se está vivo

## Critérios de Aceite

1. `GET /api/v1/pid/:pid/alive` retorna `{ alive: true }` para PID de processo existente
2. `GET /api/v1/pid/:pid/alive` retorna `{ alive: false }` para PID inexistente
3. `GET /api/v1/pid/:pid/alive` retorna 400 se PID não é numérico
4. `GET /api/v1/runs/active` retorna apenas runs com status `running`, enriquecidos com `alive`
5. A função `isPidAlive` funciona em Windows e Linux (ambos suportam `process.kill(pid, 0)`)

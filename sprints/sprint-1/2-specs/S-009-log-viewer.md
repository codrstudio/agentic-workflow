# S-009 — Log Viewer de spawn.jsonl

**Discoveries:** D-008 (score 7)

## Objetivo

Visualizar o conteúdo de spawn.jsonl de um step específico, com parsing das mensagens do Claude CLI e highlight por tipo (assistant, tool, system, user).

## Escopo

### Backend (apps/hub)

- Endpoint para ler e parsear spawn.jsonl de um step

### Frontend (apps/web)

- Página `/projects/:slug/waves/:waveNumber/steps/:stepIndex`
- Exibição de metadados do step (spawn.json)
- Log viewer com mensagens parseadas
- Scroll virtual para logs grandes
- Highlight por tipo de mensagem

## API Endpoints

### `GET /api/v1/projects/:slug/waves/:waveNumber/steps/:stepIndex`

**Response 200:**
```json
{
  "metadata": {
    "task": "compile-brainstorming",
    "agent": "general",
    "pid": 12345,
    "started_at": "2026-03-09T12:00:00Z",
    "ended_at": "2026-03-09T12:05:00Z",
    "duration_ms": 300000,
    "exit_code": 0
  },
  "log_lines": 150,
  "log_size_bytes": 45000
}
```

### `GET /api/v1/projects/:slug/waves/:waveNumber/steps/:stepIndex/log`

**Query params:**
- `offset` (default 0) — linha inicial
- `limit` (default 100) — quantidade de linhas

**Response 200:**
```json
{
  "lines": [
    {
      "index": 0,
      "type": "system",
      "timestamp": "2026-03-09T12:00:00Z",
      "content": "Starting task..."
    },
    {
      "index": 1,
      "type": "assistant",
      "timestamp": "2026-03-09T12:00:01Z",
      "content": "I'll begin by reading the files..."
    }
  ],
  "total": 150,
  "has_more": true
}
```

## Parsing de spawn.jsonl

O arquivo spawn.jsonl contém uma linha JSON por evento do Claude CLI. O hub parseia cada linha e classifica por tipo:
- `type: "system"` — mensagens do sistema
- `type: "assistant"` — respostas do agente
- `type: "tool_use"` / `type: "tool_result"` — chamadas e respostas de ferramentas
- `type: "user"` — mensagens do operador

## Componentes Frontend

### StepDetail

- Header com metadados do step (task, agent, timing, exit code)
- Badge de status (success/failure)

### LogViewer

- Lista virtualizada (react-window ou similar) para performance com logs grandes
- Cada mensagem com ícone/cor por tipo:
  - assistant → azul
  - tool_use → roxo
  - tool_result → cinza
  - system → amarelo
  - user → verde
- Botão "Ir para o fim" (scroll to bottom)
- Busca textual dentro do log (client-side filter)

## Critérios de Aceite

1. `GET .../steps/:stepIndex` retorna metadados do step
2. `GET .../steps/:stepIndex/log` retorna linhas parseadas com paginação
3. Log viewer renderiza mensagens com cores por tipo
4. Scroll virtual funciona com logs de 1000+ linhas sem lag
5. Busca textual filtra mensagens
6. Funciona em mobile com scroll horizontal para conteúdo largo

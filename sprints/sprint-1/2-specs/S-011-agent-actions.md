# S-011 — Gestão de Agent Actions

**Discoveries:** D-011 (score 6)

## Objetivo

Armazenar e exibir o lifecycle das agent actions reportadas pelo `AgentActionReporter` da engine. O reporter já faz POST/PATCH para o hub — o hub precisa persistir e expor esses dados.

## Escopo

### Backend (apps/hub)

- Implementar os endpoints que `AgentActionReporter` já chama
- Armazenar actions em memória (Map)
- Expor lista de actions por projeto

### Frontend (apps/web)

- Seção de agent actions na página de detalhe do projeto
- Lista com status, duração, task, agent profile

## API Endpoints

### `POST /api/v1/hub/projects/:slug/agent-actions`

(Chamado pela engine — já especificado no `AgentActionReporter`)

**Request:**
```json
{
  "action_type": "spawn-agent",
  "started_at": "2026-03-09T12:00:00Z",
  "requires_approval": false,
  "agent_profile": "coder",
  "task_name": "implement-feature",
  "feature_id": "F-001",
  "spawn_dir": "/path/to/step-06-ralph-wiggum-loop/F-001-attempt-1"
}
```

**Response 201:**
```json
{
  "id": "action-uuid"
}
```

### `PATCH /api/v1/hub/projects/:slug/agent-actions/:id`

(Chamado pela engine)

**Request:**
```json
{
  "status": "completed",
  "completed_at": "2026-03-09T12:05:00Z",
  "duration_ms": 300000,
  "exit_code": 0,
  "output_preview": "Feature F-001 implemented successfully..."
}
```

### `GET /api/v1/projects/:slug/agent-actions`

**Response 200:**
```json
[
  {
    "id": "action-uuid",
    "action_type": "spawn-agent",
    "status": "completed",
    "agent_profile": "coder",
    "task_name": "implement-feature",
    "feature_id": "F-001",
    "started_at": "2026-03-09T12:00:00Z",
    "completed_at": "2026-03-09T12:05:00Z",
    "duration_ms": 300000,
    "exit_code": 0,
    "output_preview": "Feature F-001 implemented..."
  }
]
```

## Componentes Frontend

### AgentActionsList

- Tabela/lista compacta de actions
- Colunas: status (badge), task, agent, feature, duração, preview
- Ordenação por data (mais recente primeiro)
- Action em andamento (running) com indicador animado
- Click na action expande preview do output

## Critérios de Aceite

1. `POST agent-actions` armazena action e retorna id
2. `PATCH agent-actions/:id` atualiza status da action
3. `GET agent-actions` lista todas as actions do projeto
4. Eventos SSE emitidos ao criar/atualizar actions (S-006)
5. Frontend exibe lista de actions com status correto
6. Actions em andamento têm indicador visual
7. Preview do output visível ao expandir a action

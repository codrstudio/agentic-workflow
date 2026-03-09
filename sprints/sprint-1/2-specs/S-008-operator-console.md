# S-008 — Console do Operador via UI

**Discoveries:** D-009 (score 7)

## Objetivo

Equivalente web ao `aw:console`. Permitir que o operador envie mensagens para a engine via OperatorQueue e acompanhe o status das mensagens (pendente/processando/concluída).

## Escopo

### Backend (apps/hub)

- Endpoint para enfileirar mensagem
- Endpoint para listar mensagens
- Emitir eventos SSE quando mensagem muda de status

### Frontend (apps/web)

- Página `/console` com:
  - Campo de texto para escrever mensagem
  - Botão enviar
  - Lista de mensagens com status badges
  - Atualização via SSE

## API Endpoints

### `POST /api/v1/projects/:slug/messages`

**Request:**
```json
{
  "content": "Mensagem para o agente",
  "target_step": "step-06-ralph-wiggum-loop"
}
```

**Response 201:**
```json
{
  "id": "msg-1741536000000",
  "content": "Mensagem para o agente",
  "status": "queued",
  "created_at": "2026-03-09T12:00:00Z"
}
```

### `GET /api/v1/projects/:slug/messages`

**Response 200:**
```json
[
  {
    "id": "msg-1741536000000",
    "content": "Mensagem para o agente",
    "status": "queued",
    "created_at": "2026-03-09T12:00:00Z"
  },
  {
    "id": "msg-1741535000000",
    "content": "Outra mensagem",
    "status": "done",
    "created_at": "2026-03-09T11:50:00Z",
    "processed_at": "2026-03-09T11:51:00Z"
  }
]
```

## Lógica de Enfileiramento

O hub escreve no arquivo `operator-queue.jsonl` do workspace ativo, replicando a lógica do `OperatorQueue.enqueue()` da engine:

```jsonl
{"id":"msg-xxx","content":"...","status":"queued","created_at":"..."}
```

A engine drena a fila (`OperatorQueue.drain()`) e atualiza o status. O hub monitora mudanças no arquivo para emitir SSE com status atualizado.

Alternativa: o hub expõe um endpoint que a engine consome (pull model), evitando file watching.

## Componentes Frontend

### ConsoleView

- Select de projeto ativo no topo (ou contexto da rota)
- Campo de texto + botão enviar
- Lista de mensagens em ordem cronológica reversa
- Badge de status: `queued` (amarelo), `processing` (azul), `done` (verde)
- Timestamp relativo ("há 2 min")

## Critérios de Aceite

1. `POST /api/v1/projects/:slug/messages` enfileira mensagem e retorna 201
2. `GET /api/v1/projects/:slug/messages` lista mensagens com status
3. Mensagem aparece na lista imediatamente após envio
4. Status atualiza via SSE quando engine processa a mensagem
5. Interface funciona em mobile
6. Campo de texto tem focus automático e suporta Enter para enviar

# PRP-007 — Console do Operador

**Specs:** S-008
**Prioridade:** 7
**Dependências:** PRP-001, PRP-003, PRP-005

## Objetivo

Equivalente web ao `aw:console`. Permitir que o operador envie mensagens para a engine via OperatorQueue e acompanhe o status das mensagens (queued/processing/done) em tempo real via SSE.

## Escopo

### Backend (apps/hub)

- `POST /api/v1/projects/:slug/messages` — enfileira mensagem no `operator-queue.jsonl`
- `GET /api/v1/projects/:slug/messages` — lista mensagens com status
- Replica lógica do `OperatorQueue.enqueue()` da engine
- Emite eventos SSE quando status de mensagem muda

### Frontend (apps/web)

- Página `/console`:
  - Select de projeto ativo no topo
  - Campo de texto + botão enviar (Enter para enviar)
  - Lista de mensagens em ordem cronológica reversa
  - Badge de status: queued (amarelo), processing (azul), done (verde)
  - Timestamp relativo ("há 2 min")
  - Atualização via SSE

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-021 | Operator Messages API | `POST /projects/:slug/messages` (enfileira no operator-queue.jsonl) e `GET /projects/:slug/messages` (lista com status). Emissão de evento SSE ao enfileirar. |
| F-022 | Console UI | Página `/console` com select de projeto, campo de texto com focus automático, botão enviar, lista de mensagens com badges de status, timestamps relativos. Atualização reativa via SSE. Layout responsivo mobile. |

## Limites

- NÃO implementa chat bidirecional (apenas enqueue de mensagens para a engine)
- NÃO implementa persistência além do `operator-queue.jsonl` existente
- NÃO monitora drain da fila (a engine faz drain — o hub observa mudanças via SSE)

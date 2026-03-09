# S-005 — Execução de Projeto via UI

**Discoveries:** D-005 (score 8)

## Objetivo

Permitir que o operador dispare a execução de um workflow de projeto diretamente pela interface, equivalente ao `npm run aw:run -- <project> <workflow>`.

## Escopo

### Backend (apps/hub)

- Endpoint para iniciar execução
- Spawn do CLI da engine como child process
- Tracking do PID e status do processo
- Armazenamento em memória das execuções ativas

### Frontend (apps/web)

- Formulário de execução na página de detalhe do projeto (`/projects/:slug`)
- Select de workflow (dados de S-004)
- Input opcional de plano
- Botão "Executar"
- Exibição de execuções ativas com PID e status

## API Endpoints

### `POST /api/v1/projects/:slug/runs`

**Request:**
```json
{
  "workflow": "vibe-app",
  "plan": "optional-plan-slug"
}
```

**Response 201:**
```json
{
  "id": "run-1741536000000",
  "project": "aw-monitor",
  "workflow": "vibe-app",
  "pid": 12345,
  "status": "running",
  "started_at": "2026-03-09T12:00:00Z"
}
```

### `GET /api/v1/projects/:slug/runs`

**Response 200:** Lista de execuções (ativas e recentes).

```json
[
  {
    "id": "run-1741536000000",
    "workflow": "vibe-app",
    "pid": 12345,
    "status": "running",
    "started_at": "2026-03-09T12:00:00Z"
  }
]
```

### `DELETE /api/v1/projects/:slug/runs/:runId`

Envia SIGTERM ao processo. Status muda para `stopping`.

## Lógica de Spawn

```
node apps/engine/dist/cli.js <project-slug> <workflow-slug> [--plan <plan>]
```

- Executado com `dotenv -e .env --` como prefix (ou carregando .env no hub)
- CWD = raiz do monorepo
- Capturar PID do child process
- Monitorar evento `exit` para atualizar status
- Stdout/stderr capturados para logging (não expostos ao frontend — logs ficam no spawn.jsonl)

## Estado em Memória

```typescript
interface Run {
  id: string
  project: string
  workflow: string
  plan?: string
  pid: number
  status: 'running' | 'stopping' | 'completed' | 'failed'
  started_at: string
  ended_at?: string
  exit_code?: number
}
```

Runs são armazenados em Map em memória. Não persistidos (se o hub reinicia, runs anteriores são perdidos — aceitável para v1).

## Critérios de Aceite

1. `POST /api/v1/projects/:slug/runs` spawna o CLI da engine e retorna 201
2. Processo da engine executa com as variáveis de ambiente corretas
3. `GET /api/v1/projects/:slug/runs` lista execuções com status atualizado
4. `DELETE /api/v1/projects/:slug/runs/:runId` envia SIGTERM ao processo
5. Frontend exibe formulário com select de workflow na página do projeto
6. Após execução, card com PID e status aparece na lista
7. Botão de parar execução funciona

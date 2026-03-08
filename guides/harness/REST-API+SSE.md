# Harness REST API + SSE Guide

Complete reference for the Agentic Workflow Harness REST/SSE interface exposed by the Server.

**Base URL**: `http://localhost:2101/api/v1/harness`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Run Management](#run-management)
4. [Events (SSE)](#events-sse)
5. [Workspace Status](#workspace-status)
6. [Error Handling](#error-handling)
7. [Examples](#examples)

---

## Overview

The Harness API allows you to:
- Start and monitor workflow runs
- List runs and check their status
- Subscribe to real-time engine events via SSE
- Query workspace and step execution history

**Architecture**: Server consumes `@aw/engine` library directly (no proxy).

---

## Authentication

Currently **no authentication required**. All endpoints are public.

---

## Run Management

### 1. Health Check

```
GET /api/v1/harness/health
```

Check if the harness service is running and count active runs.

**Response** `200 OK`:
```json
{
  "ok": true,
  "runs": 2
}
```

**Example**:
```bash
curl http://localhost:2101/api/v1/harness/health
```

---

### 2. Start a Workflow Run

```
POST /api/v1/harness/runs
Content-Type: application/json
```

Start a new workflow run **non-blocking**. Returns immediately with `run_id`.

**Request Body**:
```json
{
  "projectSlug": "arc",
  "workflowSlug": "vibe-app",
  "planSlug": "standard"
}
```

**Fields**:
- `projectSlug` (required, string) — Project identifier (e.g., "arc", "ab-hub")
- `workflowSlug` (required, string) — Workflow name from `context/workflows/`
- `planSlug` (optional, string) — Plan name from `context/plans/` (defaults to project config or "standard")

**Response** `201 Created`:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "projectSlug": "arc",
  "workflowSlug": "vibe-app",
  "status": "pending",
  "created_at": "2026-03-08T12:34:56.000Z"
}
```

**Status Progression**:
```
pending → running → completed (exit_code=0)
       ↘ running → failed (exit_code=1)
       ↘ running → stopped (exit_code=128)
```

**Example**:
```bash
curl -X POST http://localhost:2101/api/v1/harness/runs \
  -H "Content-Type: application/json" \
  -d '{
    "projectSlug": "arc",
    "workflowSlug": "vibe-app"
  }'
```

---

### 3. List Runs

```
GET /api/v1/harness/runs[?project=slug]
```

List all runs, optionally filtered by project.

**Query Parameters**:
- `project` (optional, string) — Filter by project slug

**Response** `200 OK`:
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "projectSlug": "arc",
    "workflowSlug": "vibe-app",
    "planSlug": "standard",
    "status": "running",
    "created_at": "2026-03-08T12:34:56.000Z",
    "started_at": "2026-03-08T12:35:00.000Z",
    "finished_at": null,
    "exit_code": null,
    "reason": null
  },
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "projectSlug": "arc",
    "workflowSlug": "vibe-app",
    "planSlug": null,
    "status": "completed",
    "created_at": "2026-03-08T11:00:00.000Z",
    "started_at": "2026-03-08T11:00:05.000Z",
    "finished_at": "2026-03-08T11:45:30.000Z",
    "exit_code": 0,
    "reason": null
  }
]
```

**Example**:
```bash
# List all runs
curl http://localhost:2101/api/v1/harness/runs

# Filter by project
curl http://localhost:2101/api/v1/harness/runs?project=arc
```

---

### 4. Get Run Status

```
GET /api/v1/harness/runs/:runId
```

Get detailed status of a specific run.

**Path Parameters**:
- `runId` (required, string) — Run ID from POST response

**Response** `200 OK`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "projectSlug": "arc",
  "workflowSlug": "vibe-app",
  "planSlug": "standard",
  "status": "running",
  "created_at": "2026-03-08T12:34:56.000Z",
  "started_at": "2026-03-08T12:35:00.000Z",
  "finished_at": null,
  "exit_code": null,
  "reason": null
}
```

**Response** `404 Not Found`:
```json
{
  "error": "Run not found"
}
```

**Example**:
```bash
curl http://localhost:2101/api/v1/harness/runs/550e8400-e29b-41d4-a716-446655440000
```

---

### 5. Stop a Run

```
DELETE /api/v1/harness/runs/:runId
```

Stop a running workflow.

**Response** `200 OK`:
```json
{
  "ok": true
}
```

**Response** `404 Not Found`:
```json
{
  "error": "Run not found"
}
```

**Example**:
```bash
curl -X DELETE http://localhost:2101/api/v1/harness/runs/550e8400-e29b-41d4-a716-446655440000
```

---

## Events (SSE)

### Subscribe to Run Events

```
GET /api/v1/harness/runs/:runId/events
```

Stream real-time engine events as **Server-Sent Events (SSE)**.

**Connection**: Long-lived HTTP stream
- **Heartbeat**: Every 30 seconds (keeps connection alive)
- **Auto-reconnect**: Client should implement exponential backoff
- **Encoding**: JSON events

**Response Stream**:

1. **Connection Event** (immediate):
```json
{
  "type": "connected",
  "data": {
    "run_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-03-08T12:35:00.000Z"
  }
}
```

2. **Engine Events** (from WorkflowRunner):
```json
{
  "type": "engine:event",
  "data": {
    "type": "step.start",
    "step": 1,
    "name": "pain-gain-analysis",
    "timestamp": "2026-03-08T12:35:05.000Z"
  }
}
```

3. **Heartbeat** (every 30s):
```json
{
  "type": "heartbeat",
  "data": {
    "timestamp": "2026-03-08T12:35:30.000Z"
  }
}
```

**Engine Event Types**:
- `step.start` — Step execution started
- `step.complete` — Step completed successfully
- `step.fail` — Step failed
- `loop.iteration` — Feature loop iteration
- `wave.complete` — Wave execution completed
- `engine:event` — Generic engine event

**Example** (curl):
```bash
curl -N http://localhost:2101/api/v1/harness/runs/550e8400-e29b-41d4-a716-446655440000/events
```

**Example** (JavaScript):
```javascript
const eventSource = new EventSource(
  'http://localhost:2101/api/v1/harness/runs/550e8400-e29b-41d4-a716-446655440000/events'
);

eventSource.addEventListener('connected', (event) => {
  const data = JSON.parse(event.data);
  console.log('Connected to run:', data.run_id);
});

eventSource.addEventListener('engine:event', (event) => {
  const data = JSON.parse(event.data);
  console.log('Engine event:', data);
});

eventSource.addEventListener('heartbeat', (event) => {
  console.log('Heartbeat received');
});

eventSource.onerror = () => {
  console.error('SSE connection lost, attempting reconnect...');
  eventSource.close();
};
```

---

## Workspace Status

### Get Project Harness Status

```
GET /api/v1/harness/hub/projects/:slug/harness/status
```

Get execution status of all waves and steps for a project.

**Path Parameters**:
- `slug` (required, string) — Project slug

**Response** `200 OK`:
```json
{
  "project": "arc",
  "waves": [
    {
      "number": 1,
      "steps": [
        {
          "number": 1,
          "name": "pain-gain-analysis",
          "type": "spawn-agent",
          "task": "pain-gain-analysis",
          "agent": "researcher",
          "status": "completed",
          "started_at": "2026-03-08T12:35:05.000Z",
          "finished_at": "2026-03-08T12:45:30.000Z",
          "exit_code": 0,
          "duration_ms": 625000
        }
      ],
      "status": "completed"
    }
  ],
  "current_wave": 1,
  "status": "completed"
}
```

**Step Status**: `pending | running | completed | failed`
**Wave Status**: `idle | running | completed | failed`

**Example**:
```bash
curl http://localhost:2101/api/v1/harness/hub/projects/arc/harness/status
```

---

### Get Step Details

```
GET /api/v1/harness/hub/projects/:slug/harness/waves/:waveNumber/steps/:stepNumber
```

Get detailed status of a specific step.

**Path Parameters**:
- `slug` (required, string) — Project slug
- `waveNumber` (required, number) — Wave number (1-indexed)
- `stepNumber` (required, number) — Step number (1-indexed)

**Response** `200 OK`:
```json
{
  "wave": 1,
  "step": 1,
  "name": "pain-gain-analysis",
  "type": "spawn-agent",
  "task": "pain-gain-analysis",
  "agent": "researcher",
  "status": "completed",
  "started_at": "2026-03-08T12:35:05.000Z",
  "finished_at": "2026-03-08T12:45:30.000Z",
  "exit_code": 0,
  "pid": 12345,
  "timed_out": false,
  "duration_ms": 625000,
  "loop": null
}
```

**Example**:
```bash
curl http://localhost:2101/api/v1/harness/hub/projects/arc/harness/waves/1/steps/1
```

---

### Get Step Logs

```
GET /api/v1/harness/hub/projects/:slug/harness/waves/:waveNumber/steps/:stepNumber/log[?tail=N]
```

Tail the spawn.jsonl log file for a step (last N lines).

**Path Parameters**:
- `slug` (required, string) — Project slug
- `waveNumber` (required, number) — Wave number
- `stepNumber` (required, number) — Step number

**Query Parameters**:
- `tail` (optional, number) — Number of lines to return (1-1000, default: 100)

**Response** `200 OK`:
```json
{
  "wave": 1,
  "step": 1,
  "total_lines": 450,
  "returned_lines": 100,
  "lines": [
    "{\"type\":\"message\",\"data\":{...}}",
    "{\"type\":\"message\",\"data\":{...}}",
    "..."
  ]
}
```

**Example**:
```bash
# Last 100 lines (default)
curl http://localhost:2101/api/v1/harness/hub/projects/arc/harness/waves/1/steps/1/log

# Last 50 lines
curl http://localhost:2101/api/v1/harness/hub/projects/arc/harness/waves/1/steps/1/log?tail=50
```

---

## Error Handling

### Error Response Format

All errors return a standard error object:

```json
{
  "error": "Error description"
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK — Request succeeded |
| `201` | Created — Run successfully created |
| `400` | Bad Request — Validation error |
| `404` | Not Found — Run/project not found |
| `500` | Internal Server Error — Server error |

### Common Errors

**Missing Required Fields**:
```json
{
  "error": "projectSlug is required"
}
```

**Run Not Found**:
```json
{
  "error": "Run not found"
}
```

**Invalid Project**:
```json
{
  "error": "Project 'invalid' not found"
}
```

---

## Examples

### Complete Workflow: Start, Monitor, Stop

```bash
#!/bin/bash

# 1. Start a run
RUN_RESPONSE=$(curl -s -X POST http://localhost:2101/api/v1/harness/runs \
  -H "Content-Type: application/json" \
  -d '{
    "projectSlug": "arc",
    "workflowSlug": "vibe-app"
  }')

RUN_ID=$(echo $RUN_RESPONSE | jq -r '.run_id')
echo "Started run: $RUN_ID"

# 2. Subscribe to events (background)
curl -N http://localhost:2101/api/v1/harness/runs/$RUN_ID/events &
EVENT_PID=$!

# 3. Poll status every 10 seconds
for i in {1..60}; do
  STATUS=$(curl -s http://localhost:2101/api/v1/harness/runs/$RUN_ID | jq -r '.status')
  echo "[$i] Status: $STATUS"

  if [ "$STATUS" == "completed" ] || [ "$STATUS" == "failed" ]; then
    break
  fi
  sleep 10
done

# 4. Kill event stream
kill $EVENT_PID 2>/dev/null

# 5. Get final status
curl -s http://localhost:2101/api/v1/harness/runs/$RUN_ID | jq .
```

### Monitor with Real-time Events (Node.js)

```javascript
const runId = '550e8400-e29b-41d4-a716-446655440000';

const eventSource = new EventSource(
  `http://localhost:2101/api/v1/harness/runs/${runId}/events`
);

eventSource.addEventListener('connected', (e) => {
  console.log('✓ Connected to run:', JSON.parse(e.data).run_id);
});

eventSource.addEventListener('engine:event', (e) => {
  const event = JSON.parse(e.data);

  switch (event.type) {
    case 'step.start':
      console.log(`▶ Step ${event.step} started: ${event.name}`);
      break;
    case 'step.complete':
      console.log(`✓ Step ${event.step} completed`);
      break;
    case 'step.fail':
      console.log(`✗ Step ${event.step} failed`);
      break;
    case 'wave.complete':
      console.log(`✓ Wave ${event.wave} completed`);
      break;
  }
});

eventSource.onerror = (e) => {
  console.error('✗ Event stream error:', e);
  eventSource.close();
};

// Manual polling as backup
setInterval(async () => {
  const res = await fetch(`http://localhost:2101/api/v1/harness/runs/${runId}`);
  const run = await res.json();

  if (run.status === 'completed') {
    console.log(`✓ Run completed with exit code ${run.exit_code}`);
    eventSource.close();
    process.exit(run.exit_code || 0);
  }
}, 5000);
```

### List and Filter Runs (Python)

```python
import requests
import json
from datetime import datetime

BASE_URL = 'http://localhost:2101/api/v1/harness'

def list_runs(project=None):
    """List all runs, optionally filtered by project."""
    params = {'project': project} if project else {}
    response = requests.get(f'{BASE_URL}/runs', params=params)
    return response.json()

def get_run(run_id):
    """Get run details."""
    response = requests.get(f'{BASE_URL}/runs/{run_id}')
    return response.json()

# List all runs
all_runs = list_runs()
print(f'Total runs: {len(all_runs)}')

# List runs for 'arc' project
arc_runs = list_runs(project='arc')
for run in arc_runs:
    status = run['status']
    created = datetime.fromisoformat(run['created_at'].replace('Z', '+00:00'))
    print(f"  {run['id'][:8]}... | {status:12} | {run['workflowSlug']}")

# Get latest run
if arc_runs:
    latest = arc_runs[0]
    details = get_run(latest['id'])
    print(f"\nLatest run details:")
    print(json.dumps(details, indent=2))
```

---

## Changelog

### v1.0 (Current)
- ✅ Run management (start, list, get, stop)
- ✅ Real-time SSE events
- ✅ Workspace/step status
- ✅ Log streaming
- ⏳ Authentication (planned)
- ⏳ Rate limiting (planned)

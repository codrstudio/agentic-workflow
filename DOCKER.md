# Docker Compose Setup

## Overview

This project uses Docker Compose to orchestrate the **server** and **web** services.

### Services

- **server**: Hono-based API server (Node.js + tsx)
  - Port: `2101` (configurable via `SERVER_PORT`)
  - Health check: `/health` endpoint
  - Restart policy: `unless-stopped`

- **web**: React SPA with Vite
  - Port: `2102` (configurable via `WEB_PORT`)
  - Built with `http-server` for SPA serving
  - Single-page app fallback enabled (`-s` flag)
  - Restart policy: `unless-stopped`

## Prerequisites

- Docker and Docker Compose installed
- Node.js 20+ (for local development, optional for Docker)
- Environment variables configured (see `.env` or `.env.example`)

## Quick Start

### Development with Docker

```bash
# Start services
docker-compose -f docker.compose.yml up

# Start in background
docker-compose -f docker.compose.yml up -d

# View logs
docker-compose -f docker.compose.yml logs -f

# Stop services
docker-compose -f docker.compose.yml down
```

### Build and Run

```bash
# Build images (if not already cached)
docker-compose -f docker.compose.yml build

# Run with fresh builds
docker-compose -f docker.compose.yml up --build

# Run specific service
docker-compose -f docker.compose.yml up server
```

## Environment Configuration

Copy `.env.example` to `.env` and update as needed:

```bash
cp .env.example .env
```

Key variables:

- `ENVIRONMENT`: `development` or `production`
- `NODE_ENV`: Node.js environment
- `SERVER_PORT`: Server port (default: `2101`)
- `WEB_PORT`: Web port (default: `2102`)
- `CONTEXT_FOLDER`: Path to context directory

## Service Communication

### Internal Network

Services communicate via the `arc-internal` bridge network:

- **Server**: `server.internal:2101`
- **Web**: `web.internal:2102`

### External Access

Services are exposed on localhost:

- **Server**: `http://localhost:2101`
- **Web**: `http://localhost:2102`

## Health Checks

Both services include health checks:

```bash
# Check server health
curl http://localhost:2101/health

# Check web availability
curl http://localhost:2102/
```

Health checks run every 30 seconds with a 3-second timeout.

## Resource Limits

Services are configured with resource limits:

- **CPU**: Max 1 CPU, reserved 0.5 CPU
- **Memory**: Max 512MB, reserved 256MB

Adjust in `docker.compose.yml` under `deploy.resources` if needed.

## Volumes

### Server

- `./context:/app/context:ro` (read-only for context files)
- `./data:/app/data` (persistent data directory)

### Web

- Built artifacts are copied into container (immutable)

## Networking

Two networks are configured:

1. **arc-internal**: Private bridge network for service-to-service communication
2. **arc-shared**: Additional network for future services (database, cache, etc.)

## Troubleshooting

### Services won't start

Check logs:
```bash
docker-compose -f docker.compose.yml logs server
docker-compose -f docker.compose.yml logs web
```

### Port conflicts

Update ports in `.env`:
```bash
SERVER_PORT=3001
WEB_PORT=3002
```

### Clear everything and rebuild

```bash
docker-compose -f docker.compose.yml down -v
docker-compose -f docker.compose.yml up --build
```

## Production Considerations

For production deployments:

1. Use environment-specific `.env` files
2. Set `ENVIRONMENT=production` and `NODE_ENV=production`
3. Increase resource limits as needed
4. Use a reverse proxy (nginx) for SSL/TLS
5. Configure external networks for database/cache services
6. Use secrets management for sensitive variables
7. Enable logging to external service (e.g., ELK stack)

## Files

- `docker-compose.yml`: Service orchestration
- `apps/server/Dockerfile`: Server build instructions
- `apps/web/Dockerfile`: Web build instructions
- `.dockerignore`: Files to exclude from Docker builds
- `.env`: Environment variables (create from `.env.example`)

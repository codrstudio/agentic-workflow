# .env Guide

## Estrutura

O `.env` tem duas camadas:

1. **Defaults Docker** (topo do arquivo) — valores para quando tudo roda embarcado
   no Docker. Hosts usam `*.internal`, portas sao as internas dos containers.

2. **DEV OVERRIDES** (fundo do arquivo) — sobrescreve os defaults para dev local.
   Hosts viram `localhost`, portas viram as exportadas via `${PREFIX}XX`.

A ultima definicao de uma variavel vence. Em dev, os overrides ficam ativos e
sobrescrevem os defaults. Em producao/staging, basta comentar a secao inteira
de DEV OVERRIDES.

## PREFIX — esquema de portas

Todas as portas sao derivadas de `PREFIX`. O default e `20`:

    PREFIX=20  →  portas 2000-2039
    PREFIX=30  →  portas 3000-3039  (escapar conflitos)

### Mapa de portas (${PREFIX}XX)

    Sources (apps)
      ${PREFIX}00  PUBLIC_PORT   (caddy/proxy)
      ${PREFIX}02  CENTRAL_PORT
      ${PREFIX}03  LOJISTA_PORT
      ${PREFIX}04  MOTOBOY_PORT
      ${PREFIX}05  BACKBONE_PORT

    Databases (exportadas)
      ${PREFIX}10  POSTGRES
      ${PREFIX}11  MONGO
      ${PREFIX}12  REDIS

    Tools (exportadas)
      ${PREFIX}22  EVOLUTION
      ${PREFIX}23  N8N
      ${PREFIX}25  WHISPER

    Supabase (exportadas)
      ${PREFIX}30  KONG HTTP
      ${PREFIX}31  KONG HTTPS
      ${PREFIX}32  STUDIO

Para mudar todas as portas de uma vez, basta alterar `PREFIX`.

## Modos de operacao

### Producao / Staging

- Comando: `npm run docker:*`
- Compose: `docker-compose.yml` (inclui `docker-compose.platform.yml`)
- Tudo embarcado no Docker — sources + infra
- Usa os defaults do topo: hosts `*.internal`, portas internas
- DEV OVERRIDES deve estar comentado

### Dev

- Comando: `npm run platform:*`
- Compose: `docker-compose.platform.yml` + `docker-compose.platform.dev-ports.yml`
- Somente infra sobe no Docker (postgres, redis, kong, etc.)
- Sources (central, lojista, motoboy, backbone) rodam no host
- DEV OVERRIDES ativo: hosts = `localhost`, portas = `${PREFIX}XX`
- `BACKBONE_BACKPORT=host.docker.internal` permite containers Docker
  acessarem o backbone rodando no host

## Sources

    central  :${PREFIX}02  — app operacional da empresa
    lojista  :${PREFIX}03  — app do lojista (pedidos)
    motoboy  :${PREFIX}04  — app do motoboy
    backbone :${PREFIX}05  — espinha dorsal (node+hono)

## Variaveis compostas

Algumas variaveis sao montadas a partir de outras:

    REDIS_URL            = redis://${REDIS_HOST}:${REDIS_PORT}
    EVOLUTION_URL        = http://${EVOLUTION_HOST}:${EVOLUTION_PORT}
    BACKBONE_WEBHOOK_URL = http://${BACKBONE_BACKPORT}:${BACKBONE_PORT}/...
    SITE_URL             = https://${PUBLIC_DOMAIN}
    SUPABASE_PUBLIC_URL  = ${SITE_URL}

Em dev, os overrides mudam os componentes (HOST, PORT, PUBLIC_DOMAIN) e as
variaveis compostas se recalculam automaticamente.

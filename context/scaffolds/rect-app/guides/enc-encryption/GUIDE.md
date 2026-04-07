# Secrets — dotenvx (per-environment)

Arquivos `.env.{environment}` encriptados no repositório via [@dotenvx/dotenvx](https://dotenvx.com/). O `.env` runtime é gitignored (plaintext).

## Arquitetura

```
No git (encriptados):   .env.development  .env.staging  .env.production
Em uso (gitignored):    .env
```

O `.env.{env}` **nunca** é decriptado no disco. O `--stdout` do dotenvx garante isso.

## Arquivos

| Arquivo | Commitado | Descrição |
|---|---|---|
| `.env.development` | sim | Secrets de dev (encriptado) |
| `.env.staging` | sim | Secrets de staging (encriptado) |
| `.env.production` | sim | Secrets de produção (encriptado) |
| `.env` | não | Runtime (plaintext, gitignored) |
| `.env.example` | sim | Template com placeholders (sem secrets) |
| `.env.keys` | não | Chave privada (gitignored) |

## Uso

```bash
npm run secrets:decrypt                  # .env.development → .env
npm run secrets:decrypt -- staging       # .env.staging → .env
npm run secrets:decrypt -- production    # .env.production → .env

npm run secrets:encrypt                  # .env → .env.development
npm run secrets:encrypt -- staging       # .env → .env.staging
npm run secrets:encrypt -- production    # .env → .env.production
```

Os scripts `dev:*` usam `dotenvx run -f .env.development` e decriptam em memória — não é necessário decriptar antes.

## Chave privada

Todos os ambientes usam a **mesma chave** (`DOTENV_PUBLIC_KEY` genérico, sem sufixo).

### Resolução (ordem de prioridade)

1. **`DOTENV_PRIVATE_KEY` env var** — servidor/CI.
2. **`.env.keys` arquivo** — conveniência local.

### Primeiro setup

Obtenha a chave privada com um colega e:

```bash
# Arquivo local
echo "DOTENV_PRIVATE_KEY=<chave>" > .env.keys

# Ou env var (servidor/CI)
export DOTENV_PRIVATE_KEY=<chave>
```

Uma chave para tudo — development, staging, production.

## Domínios por ambiente

| Variável | Development | Staging | Production |
|---|---|---|---|
| `PUBLIC_DOMAIN` | localhost | h.chega.la | chega.la |
| `APP_DOMAIN` | localhost | h.app.chega.la | app.chega.la |
| `API_DOMAIN` | localhost | h.api.chega.la | api.chega.la |
| `APP_URL` | http://localhost | https://h.app.chega.la | https://app.chega.la |

O `docker-compose.yml` usa `${APP_DOMAIN}`, `${API_DOMAIN}` e `${PUBLIC_DOMAIN}` direto nas labels do Traefik, com nomes namespaced por `${ENVIRONMENT}` para coexistência de stacks.

## Deploy

```bash
git pull
npm run secrets:decrypt -- production    # .env.production → .env (plaintext)
docker compose up -d                     # lê .env normalmente
```

Para staging no mesmo servidor:

```bash
cd /srv/apps/h.app.chega.la
npm run secrets:decrypt -- staging
docker compose up -d
```

## Alterar um secret

```bash
npm run secrets:decrypt                  # .env.development → .env
vim .env                                 # edite normalmente
npm run secrets:encrypt                  # .env → .env.development (encriptado)
git add .env.development
git commit -m "chore: update secrets"
```

O encrypt preserva o keypair existente — a chave privada não muda.

## Criar novo ambiente

```bash
vim .env                                 # ajustar valores para o novo ambiente
npm run secrets:encrypt -- staging       # cria .env.staging (reusa keypair compartilhado)
git add .env.staging
git commit -m "chore: add staging secrets"
```

## Notas

- dotenvx encripta valores inline — nomes de variáveis ficam visíveis no diff.
- `dotenvx run -f .env.development` decripta em memória, nunca toca o disco.
- `secrets.sh` preserva a public key genérica ao re-encriptar, mantendo o keypair compartilhado.
- `secrets.sh` limpa o header dotenvx do `.env` no decrypt (sem lixo no runtime).

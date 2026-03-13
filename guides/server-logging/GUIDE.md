# Server Logging com Pino e LOG_LEVEL

## Motivação

O `hono/logger` padrão não suporta níveis de log. Qualquer request — inclusive rotas de polling/monitor — aparece no terminal sem forma de reduzir o ruído sem modificar código.

A solução é substituí-lo por **pino**, que tem nível de log configurável via `LOG_LEVEL` no `.env.local`.

---

## Arquitetura

```
.env           → LOG_LEVEL=info   (padrão, commitado)
.env.local     → LOG_LEVEL=warn   (override local, gitignored)
       │
       ▼
dotenv-flow CLI (carrega .env → .env.local, .env.local sobrescreve)
       │
       ▼
apps/server/src/middleware/logger.ts
  pino({ level: process.env.LOG_LEVEL ?? 'info' })
       │
       ├─ info  → loga request/response (método, path, status, ms)
       └─ warn+ → silencia requests, só erros sobem
```

---

## Níveis disponíveis

| `LOG_LEVEL` | O que aparece no terminal |
|---|---|
| `trace` | tudo, incluindo internals do pino |
| `debug` | requests + dados de debug adicionais |
| `info` | requests normais (padrão) |
| `warn` | só avisos e erros — sem requests |
| `error` | só erros |
| `silent` | nada |

---

## Uso no dia a dia

### Silenciar requests (ex: monitor em desenvolvimento)

Crie `.env.local` na raiz do projeto (se não existir):

```bash
# .env.local  ← gitignored, só na sua máquina
LOG_LEVEL=warn
```

Reinicie o servidor. Os `GET /monitor` somem do terminal.

### Reativar log fino

```bash
# .env.local
LOG_LEVEL=debug
```

Ou apague a linha para voltar ao default `info` do `.env`.

### Voltar ao padrão

Delete a linha `LOG_LEVEL` do `.env.local` ou delete o arquivo inteiro.

---

## Como `.env.local` é carregado

O projeto usa `dotenv-flow` (substitui `dotenv-cli`). A precedência é:

```
.env  →  .env.local  →  variáveis de ambiente do sistema
         (sobrescreve)   (sobrescreve tudo)
```

`dotenv-flow` ignora silenciosamente arquivos que não existem — sem erro se `.env.local` não existir.

Os scripts no `package.json` raiz usam `dotenv-flow -- <cmd>` em vez de `dotenv -e .env -- <cmd>`.

---

## Implementação

### Dependências (`apps/server/package.json`)

```json
"dependencies": {
  "pino": "^9.x",
  "pino-pretty": "^13.x"
}
```

`pino-pretty` formata a saída para o terminal em desenvolvimento. Em produção (`NODE_ENV=production`) o pino loga JSON puro — adequado para coleta por ferramentas como Datadog, Loki, etc.

### Middleware (`apps/server/src/middleware/logger.ts`)

```ts
import pino from 'pino';
import type { MiddlewareHandler } from 'hono';

const logger = pino(
  { level: process.env['LOG_LEVEL'] ?? 'info' },
  process.env['NODE_ENV'] !== 'production'
    ? pino.transport({ target: 'pino-pretty', options: { colorize: true } })
    : undefined,
);

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms: Date.now() - start });
};

export { logger };
```

O `logger` exportado pode ser usado em qualquer lugar do server para emitir logs nos níveis corretos:

```ts
logger.warn('arquivo de estado corrompido, ignorando');
logger.error({ err }, 'falha ao resumir workflow');
```

### `apps/server/src/index.ts`

```ts
// Antes:
import { logger } from 'hono/logger';
app.use('*', logger());

// Depois:
import { requestLogger } from './middleware/logger.js';
app.use('*', requestLogger);
```

### `package.json` raiz

```json
// Antes:
"dev:all": "dotenv -e .env -- concurrently ...",
"aw:run":  "dotenv -e .env -- node ...",

// Depois:
"dev:all": "dotenv-flow -- concurrently ...",
"aw:run":  "dotenv-flow -- node ...",
```

---

## `.gitignore`

```
.env.local
```

`.env.local` nunca deve ser commitado — é exclusivamente para overrides locais de cada desenvolvedor.

---

## O que NÃO fazer

- **Não filtrar rotas no middleware** — isso esconde requests seletivamente de forma permanente no código, sem como reativar sem modificar código. Use `LOG_LEVEL` para controle.
- **Não hardcodar nível de log** — sempre ler de `process.env['LOG_LEVEL']`.
- **Não usar `hono/logger` em paralelo com pino** — escolha um.

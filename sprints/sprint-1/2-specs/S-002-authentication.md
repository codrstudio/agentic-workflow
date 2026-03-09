# S-002 — Autenticação

**Discoveries:** D-002 (score 9)

## Objetivo

Implementar autenticação simples via variáveis de ambiente SYSUSER, SYSPASS e SYSROLE conforme requisito do TASK.md. Proteger todas as rotas do hub e do frontend.

## Escopo

### Backend (apps/hub)

- Endpoint de login: `POST /api/v1/auth/login`
- Endpoint de verificação: `GET /api/v1/auth/me`
- Endpoint de logout: `POST /api/v1/auth/logout`
- Middleware de autenticação que protege todas as rotas `/api/v1/*` exceto `/auth/login` e `/health`
- Sessão via JWT em cookie httpOnly

### Frontend (apps/web)

- Página de login (`/login`) com formulário usuário + senha
- Redirect automático para `/login` quando não autenticado
- Armazenamento do estado de auth em contexto React
- Botão "Sair" no menu do usuário (sidebar, spec S-003)

## API Endpoints

### `POST /api/v1/auth/login`

**Request:**
```json
{
  "username": "admin",
  "password": "secret"
}
```

**Response 200:**
```json
{
  "user": {
    "username": "admin",
    "role": "operator"
  }
}
```
Set-Cookie: `aw_session=<jwt>; HttpOnly; SameSite=Strict; Path=/`

**Response 401:**
```json
{
  "error": "Invalid credentials"
}
```

### `GET /api/v1/auth/me`

**Response 200:** Retorna user info do JWT.

**Response 401:** Token ausente ou inválido.

### `POST /api/v1/auth/logout`

Limpa o cookie de sessão.

## Variáveis de Ambiente

```
SYSUSER=admin        # Username aceito
SYSPASS=secret       # Password aceito
SYSROLE=operator     # Role atribuída ao usuário
```

## Dependências

- `hono/jwt` ou `jose` — JWT signing/verification
- Nenhuma dependência nova no frontend (fetch nativo)

## Critérios de Aceite

1. `POST /api/v1/auth/login` com credenciais corretas retorna 200 e seta cookie JWT
2. `POST /api/v1/auth/login` com credenciais incorretas retorna 401
3. Requests a rotas protegidas sem cookie retornam 401
4. Requests com cookie válido passam pelo middleware
5. Frontend redireciona para `/login` quando não autenticado
6. Após login, frontend navega para a página principal
7. "Sair" limpa sessão e redireciona para `/login`

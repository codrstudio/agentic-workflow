# PRP-002 — Autenticação

**Specs:** S-002
**Prioridade:** 2
**Dependências:** PRP-001

## Objetivo

Implementar autenticação simples via SYSUSER/SYSPASS/SYSROLE. Proteger todas as rotas do hub e do frontend com sessão JWT em cookie httpOnly.

## Escopo

### Backend (apps/hub)

- Endpoint `POST /api/v1/auth/login` — valida credenciais contra env vars, retorna JWT em cookie
- Endpoint `GET /api/v1/auth/me` — retorna user info do JWT
- Endpoint `POST /api/v1/auth/logout` — limpa cookie
- Middleware de autenticação em todas as rotas `/api/v1/*` exceto `/auth/login` e `/health`

### Frontend (apps/web)

- Página de login (`/login`) com formulário usuário + senha
- Auth context React com estado do usuário
- Redirect automático para `/login` quando não autenticado
- Integração com Vite proxy para encaminhar requests ao hub

## Features

| ID | Feature | Descrição |
|----|---------|-----------|
| F-004 | Auth Backend (login/me/logout) | Endpoints de autenticação no hub. JWT signing com `hono/jwt` ou `jose`. Middleware de proteção de rotas. Variáveis SYSUSER/SYSPASS/SYSROLE. |
| F-005 | Auth Frontend (login page + context) | Página `/login` com formulário. AuthProvider React com estado do usuário. Redirect para login quando 401. Botão "Sair" integrado. Vite proxy config para `/api`. |

## Limites

- NÃO implementa roles/permissões granulares (apenas um usuário fixo)
- NÃO implementa registro de novos usuários
- NÃO implementa refresh token (JWT simples com expiração longa)

# Pneu SOS v2.0 — Visão Geral

## Premissa

A v1.0 é single-tenant: um borracheiro, um painel. A v2.0 transforma o Pneu SOS em SaaS multi-tenant, onde qualquer borracharia pode se cadastrar e ter sua própria instância.

## Mudanças Estruturais

### 1. Chamado culmina em ligação telefônica

O fluxo do cliente no portal termina com uma ligação real via `tel:`. O cliente preenche os dados do chamado (localização, tipo de pneu, problema) e quando tudo está pronto, o app dispara:

```js
window.location.href = "tel:+55XXXXXXXXXXX"
```

**Por quê:** PWAs não conseguem tocar notificação de forma confiável no iOS e Android. Em vez de depender de push notification para alertar o borracheiro, o cliente simplesmente liga. A ligação é o canal mais confiável que existe.

**Impacto:** O chamado no banco é criado *antes* da ligação. O borracheiro atende o telefone já com contexto (vê o chamado no hub). O tracking continua funcionando normalmente após a ligação.

### 2. Borracheiro convida funcionários via WhatsApp

O dono da borracharia pode adicionar funcionários enviando um link de convite pelo WhatsApp. O funcionário clica no link, entra no sistema com OTP (mesmo fluxo do cliente), e fica vinculado àquela borracharia.

**Por quê:** Borracharias são negócios pequenos. Ninguém vai baixar app corporativo nem criar conta com email. WhatsApp é o canal natural — o dono manda o link no grupo da equipe e pronto.

### 3. Auth unificado por OTP

Todos os atores (cliente, dono, funcionário) entram com o mesmo sistema de OTP por telefone. Não existe mais login por email/senha. O que diferencia cada ator é o papel (role) associado ao telefone dentro de cada tenant.

## Documentos Relacionados

- [01-fluxo-chamado-ligacao.md](01-fluxo-chamado-ligacao.md) — Detalhamento do fluxo de chamado com ligação
- [02-equipe-convite.md](02-equipe-convite.md) — Sistema de convite de funcionários

---

# Fluxo de Chamado → Ligação Telefônica

## Problema que resolve

Na v1.0, o chamado é criado e o borracheiro precisa ser notificado via push notification. PWAs no iOS e Android não garantem entrega de push — o borracheiro pode simplesmente não ver o chamado.

## Solução

O chamado no portal vira um formulário de pré-atendimento. O cliente preenche tudo e no final **liga para o borracheiro**. A ligação é o "submit" do chamado.

## Fluxo do Cliente (Portal)

```
1. Cliente abre o portal
2. Preenche: localização (GPS), tipo de veículo, problema
3. Tela de confirmação mostra resumo + número da borracharia
4. Botão "Ligar agora" → window.location.href = "tel:+55..."
5. Chamado é criado no banco com status "pending" ANTES da ligação
6. Cliente recebe link de tracking (pode acompanhar depois)
```

## Fluxo do Borracheiro (Hub)

```
1. Telefone toca
2. Borracheiro atende e vê no hub o chamado mais recente (já com todos os dados)
3. Aceita o chamado no hub → status muda para "accepted"
4. Fluxo normal: en_route → in_service → completed
```

## Detalhes Técnicos

### Criação do chamado

O chamado é criado via `POST /calls` **antes** do `tel:` redirect. O portal espera a resposta 201 e só então redireciona para a ligação.

```ts
// Portal: botão "Ligar agora"
async function handleLigar() {
  const call = await criarChamado(dadosFormulario)
  // chamado criado com sucesso, agora liga
  window.location.href = `tel:${telefoneBorracharia}`
}
```

### Número de telefone

Cada tenant (borracharia) cadastra seu número de telefone no setup. Esse número aparece no botão de ligar do portal.

### Sem push notification

Push notification deixa de ser o canal primário de alerta. Pode continuar existindo como canal secundário (notificar mudança de status para o cliente), mas não é mais crítico.

## Perguntas em aberto

- O que acontece se o cliente cria o chamado mas não liga? Timeout automático? Status "abandoned"?
- O borracheiro consegue ver chamados "pending" que ainda não tiveram ligação?
- Precisa de algum mecanismo para associar a ligação ao chamado? (provavelmente não — o borracheiro vê o chamado mais recente no hub)

---

# Sistema de Equipe — Convite via WhatsApp

## Problema que resolve

Na v1.0, existe um único login admin (email/senha). Na v2.0 multi-tenant, o dono da borracharia precisa poder adicionar funcionários que também acessam o hub.

## Solução

O dono gera um link de convite no hub e envia pelo WhatsApp. O funcionário clica, faz OTP com seu telefone, e fica vinculado à borracharia com role de "funcionário".

## Fluxo de Convite

```
1. Dono acessa "Equipe" no hub
2. Clica em "Convidar funcionário"
3. Sistema gera link único: /convite/{token}
4. Dono copia e manda no WhatsApp (botão de compartilhar)
5. Funcionário clica no link
6. Faz login por OTP (telefone)
7. Sistema vincula o telefone ao tenant com role "employee"
8. Funcionário acessa o hub com permissões de funcionário
```

## Roles

| Role | Acesso |
|------|--------|
| `owner` | Hub completo: chamados, equipe, configurações, setup |
| `employee` | Hub operacional: ver/aceitar/atualizar chamados |

## Detalhes Técnicos

### Token de convite

- Token aleatório, uso único, expira em 48h
- Tabela `invites`: `id`, `tenant_id`, `token`, `created_by`, `used_by`, `expires_at`, `used_at`
- Ao usar o token, cria vínculo `tenant_members(tenant_id, user_id, role='employee')`

### Auth unificado

Todos (cliente, owner, employee) usam OTP por telefone. O sistema identifica o contexto:

- Se veio de `/convite/{token}` → é funcionário sendo vinculado
- Se veio do portal → é cliente
- Se tem vínculo com tenant → pode acessar o hub desse tenant

### Compartilhar no WhatsApp

```ts
// Botão de compartilhar
const url = `${baseUrl}/convite/${token}`
const text = `Você foi convidado para a equipe da ${nomeBorracharia} no Pneu SOS. Acesse: ${url}`
window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
```

## Perguntas em aberto

- O dono pode remover funcionários?
- Limite de funcionários por plano?
- Funcionário pode pertencer a mais de uma borracharia?

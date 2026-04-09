# NIC — Nucleo de Inteligencia e Conhecimento

O NIC eh o companion inteligente da **Processa Sistemas**. Um chat mobile-first PWA onde colaboradores e clientes conversam com a IA da empresa.

---

## Conexao com o backbone

O NIC se conecta a um agentic-backbone existente:

```env
VITE_BACKBONE_URL=http://localhost:6002
VITE_API_KEY=nic-chat-api-key-processa-2026
VITE_AGENT_ID=nic.chat
```

---

## Biblioteca de chat

**`@codrstudio/agentic-chat`** — https://github.com/codrstudio/agentic-chat

Pacote de componentes React para chat e gerenciamento de conversas. Exporta: `Chat`, `ConversationList`, `ConversationBar`, `useConversations`, `buildInitialMessages`, `groupConversations`, `useIsMobile`.

Ler o README e os exports do pacote para entender as props e como usar.

---

## Experiencia do usuario

### 1. Login

O usuario abre o app e ve a tela de login. Campos: usuario e senha. Botao "Entrar".

Autenticacao via JWT do backbone: `POST /api/v1/ai/auth/login` com `{ username, password }`. Retorna `{ token }`.

O token eh persistido (localStorage) e usado em todas as requests como `Authorization: Bearer <token>`. Se o token expirar ou for invalido, redireciona para o login.

Identidade visual: logo do NIC, nome "NIC — Nucleo de Inteligencia e Conhecimento", rodape "Processa Sistemas".

### 2. Lista de conversas

Apos login, o usuario ve suas conversas. A lista mostra:
- Campo de busca (filtra por titulo)
- Secao "Favoritos" (conversas marcadas com estrela)
- Secao "Historico" (demais conversas, ordenadas por data)
- Botao [+] para nova conversa
- Paginacao ("Carregar mais") se houver muitas conversas

Cada conversa mostra: titulo (ou "Sem titulo"), tempo relativo ("2m", "1h", "3d"), estrela para favoritar.

Acoes por conversa: selecionar, favoritar/desfavoritar, renomear (inline).

### 3. Chat

Ao selecionar uma conversa (ou criar nova), o usuario entra no chat:
- Barra no topo com titulo da conversa + menu (renomear, exportar, excluir)
- Area de mensagens com streaming em tempo real
- Campo de input com suporte a anexos
- No mobile, seta de voltar para retornar a lista

Criar nova conversa: o [+] cria direto com o agente `nic.chat` (agente unico, sem selector) e abre o chat vazio.

### 4. Gerenciamento de conversas

Via menu da barra do chat ou interacoes na lista:
- **Renomear** — dialog para editar o titulo
- **Favoritar** — toggle de estrela (update otimista)
- **Excluir** — confirmacao antes de deletar
- **Exportar** — download em markdown

---

## Layout

### Mobile (< 768px)

Duas telas alternadas — nunca as duas ao mesmo tempo:
- **Tela 1**: lista de conversas (tela cheia)
- **Tela 2**: chat (tela cheia, com seta voltar)

### Desktop (>= 768px)

Sidebar fixa com lista de conversas + area de chat lado a lado.

---

## Requisitos gerais

- Mobile-first PWA, instalavel no celular
- Interface em pt-BR
- Dark mode
- React + Vite

---

## O que NAO eh

- NAO eh painel admin — sem takeover, approvals, orchestration, metricas
- NAO eh multi-agente — toda conversa usa `nic.chat`, sem selector de agente
- NAO tem backend proprio — consome a API do backbone existente

---

## Validacao

- [ ] Login funciona e persiste sessao
- [ ] Logout limpa token e redireciona
- [ ] Token expirado redireciona para login
- [ ] Lista de conversas carrega do backbone
- [ ] Busca filtra por titulo
- [ ] Criar nova conversa funciona
- [ ] Chat envia e recebe em streaming
- [ ] Renomear, excluir, favoritar, exportar conversas
- [ ] Mobile: alterna entre lista e chat
- [ ] Desktop: sidebar + chat lado a lado
- [ ] Dark mode
- [ ] PWA instalavel
- [ ] Anexos (upload + visualizacao)

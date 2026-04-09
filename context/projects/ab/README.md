# PRP 25 — agentic-chat: Componentes de gerenciamento de conversas

Extrair componentes reutilizaveis de gerenciamento de conversas (lista de historico, barra de contexto, hook de dados) para `@codrstudio/agentic-chat` e refatorar o Hub para consumi-los — eliminando ~900 linhas de UI acoplada a TanStack Router/Query.

## Execution Mode

`implementar`

---

## Repositorios

| Repositorio | Path local | Pacote |
|---|---|---|
| **agentic-backbone** (Hub) | `D:\sources\_unowned\agentic-backbone` | `@agentic-backbone/hub` — app consumidor |
| **agentic-chat** | `D:\sources\codr.studio\agentic-chat` | `@codrstudio/agentic-chat` — biblioteca de componentes (onde os novos componentes serao criados) |
| **agentic-sdk** | `D:\sources\codr.studio\agentic-sdk` | `@codrstudio/agentic-sdk` — runtime (nao modificado neste PRP, mas referencia para tipos) |

> As fases 1-5 sao implementadas em `D:\sources\codr.studio\agentic-chat`. A fase 6 eh implementada em `D:\sources\_unowned\agentic-backbone`.

---

## Contexto

### Estado atual

O `@codrstudio/agentic-chat` (PRPs 15/16) entrega o chat em si — `Chat`, `MessageList`, `MessageInput`, `MessageBubble`, 19 display renderers, 2 hooks. **Zero gerenciamento de sessoes.**

Toda a UI de conversas (sidebar com historico, barra de contexto no topo, renomear, excluir, exportar, favoritos, busca, criar nova conversa) vive no Hub, acoplada a:
- TanStack Router (`useNavigate`, `useSearch`, `useMatch`, `Outlet`)
- TanStack Query (`useQuery`, `useMutation`, `queryClient`)
- Auth store do Hub (`useAuthStore`)

Resultado: qualquer app que queira usar o chat com gerenciamento de sessoes precisa reimplementar ~1000 linhas de UI. O app `chat` standalone, por exemplo, nao tem nenhuma dessas funcionalidades.

### Estado desejado

1. `agentic-chat` exporta **3 componentes** e **1 hook** de conversas, alem de utilitarios
2. Componentes sao **controlados** (recebem dados + callbacks) — framework-agnostic
3. Hook `useConversations` eh **opcional** — conveniencia para quem nao tem data layer proprio
4. Componentes suportam **slots de extensao** para features especificas do consumidor
5. Hub consome os componentes, reduzindo `conversations-layout.tsx` de ~565 para ~120 linhas e `conversation-chat.tsx` de ~460 para ~100 linhas
6. Features especificas do Hub (takeover, approvals, orchestration, agent filter) continuam no Hub via slots

### Dependencias

- **PRP 16** (ai-chat shadcn) — o pacote ja usa shadcn/ui puro; esta PRP adiciona novos componentes

### O que muda

| Aspecto | Antes | Depois |
|---|---|---|
| Gerenciamento de sessoes | Zero no agentic-chat; ~1000 linhas no Hub | Componentes reutilizaveis no agentic-chat |
| ConversationList | `conversations-layout.tsx` (565 linhas, acoplado ao Hub) | Componente controlado no agentic-chat (~200 linhas) |
| ConversationBar | `conversation-chat.tsx` (460 linhas, acoplado ao Hub) | Componente controlado no agentic-chat (~150 linhas) |
| buildInitialMessages | Funcao interna do Hub (120 linhas) | Utilitario exportado do agentic-chat |
| Hub conversations | Implementacao monolitica | Composicao de componentes do agentic-chat + extensoes Hub-specific |
| Primitivos shadcn | 10 no agentic-chat | 13 (+Input, +DropdownMenu, +Skeleton) |

### O que NAO muda

| Aspecto | Motivo |
|---|---|
| API publica do Chat (`ChatProps`, hooks) | Compatibilidade existente |
| Backend API de conversas | Nenhuma mudanca de endpoint necessaria |
| Hub: TakeoverButton, TakeoverBanner | Feature especifica do backbone |
| Hub: ApprovalInlineActions | Feature especifica do backbone |
| Hub: Orchestration sidebar | Feature especifica do backbone |
| Hub: Auth store (Zustand) | Infra do Hub |

---

## Premissas de Design

### 1. Componentes controlados com slots

Componentes recebem dados e callbacks como props. Nao fazem fetch interno nem navegam. O consumidor controla tudo.

Extensibilidade via slots (ReactNode props) para features especificas:
- `ConversationList.headerExtra` — Hub coloca operator filter button
- `ConversationList.filterExtra` — Hub coloca agent Select
- `ConversationList.itemBadgesExtra` — Hub coloca badge de operador
- `ConversationBar.actionsExtra` — Hub coloca TakeoverButton
- `ConversationBar.menuItemsExtra` — Hub coloca itens extras no dropdown
- `ConversationBar.afterBar` — Hub coloca TakeoverBanner + ApprovalInlineActions

### 2. Hook useConversations eh opcional

O hook encapsula fetch + estado para quem nao tem TanStack Query ou outro data layer. Usa `useState` + `fetch` internamente — zero dependencia de library de estado.

O Hub ignora o hook e continua usando TanStack Query, passando dados para os componentes via props.

### 3. Tipo Conversation eh do agentic-chat

O agentic-chat define seu proprio tipo `Conversation` (subconjunto limpo do backend `Session`). O Hub ja tem um mapper `sessionToConversation` — continua usando-o.

Campos hub-specific (`takeover_by`, `takeover_at`) ficam num campo generico `metadata?: Record<string, unknown>` para extensibilidade, ou o Hub estende o tipo localmente.

### 4. Labels internacionalizaveis

Textos default em ingles. Props opcionais para override:
- `searchPlaceholder`, `favoritesLabel`, `historyLabel`, `loadMoreLabel`
- `renameDialogTitle`, `deleteDialogTitle`, `deleteDialogDescription`
- `emptyTitle`, `emptyDescription`

Hub passa strings em pt-BR.

### 5. Radix UI (nao Base UI)

O agentic-chat usa Radix para primitivos. Novos componentes (DropdownMenu) usam `@radix-ui/react-dropdown-menu`, nao `@base-ui/react`.

---

## Especificacao

### Fase 1 — Novos primitivos shadcn em `src/ui/`

#### 1.1 `src/ui/input.tsx`

Input HTML puro com estilizacao shadcn (sem Radix — eh um `<input>` com `cn()`):

```tsx
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
```

#### 1.2 `src/ui/dropdown-menu.tsx`

Baseado em `@radix-ui/react-dropdown-menu`. Exports: `DropdownMenu`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`.

Padrao shadcn oficial — mesma estrutura do `dialog.tsx` existente.

**Nova dependencia**: `"@radix-ui/react-dropdown-menu": "^2"`

#### 1.3 `src/ui/skeleton.tsx`

Zero dependencias. Div com `animate-pulse`:

```tsx
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-primary/10", className)} {...props} />;
}
```

#### 1.4 Atualizar `package.json`

Adicionar:
```json
"@radix-ui/react-dropdown-menu": "^2"
```

---

### Fase 2 — Tipos e utilitarios

#### 2.1 `src/conversations/types.ts`

```ts
export interface Conversation {
  id: string;
  title?: string;
  agentId: string;
  updatedAt: string;
  starred: boolean;
  metadata?: Record<string, unknown>;
}

export interface BackendMessage {
  id?: string;
  role: string;
  content: string | unknown[];
  _meta?: { id?: string; ts?: string; userId?: string; metadata?: Record<string, unknown> };
  timestamp?: string;
  metadata?: Record<string, unknown>;
}
```

#### 2.2 `src/conversations/utils.ts`

Funcoes puras extraidas do Hub:

**`formatRelativeTime(dateStr: string): string`**
Extraida de `conversations-layout.tsx:36-46`. Retorna strings em ingles por default ("now", "5m ago", "2h ago", "3d ago"). Aceita um opcional `locale` ou o consumidor faz override via `renderTimestamp` prop no item.

**`buildInitialMessages(messages: BackendMessage[]): Message[]`**
Extraida de `conversation-chat.tsx:50-172`. Funcao pura que transforma mensagens do backend (role/content/tool-call/tool-result) no formato ai-sdk (parts com tool-invocation). Elimina duplicacao — hoje o Hub tem essa funcao hardcoded.

**`groupConversations(conversations: Conversation[]): { favorites: Conversation[]; history: Conversation[] }`**
Split simples por `starred`. O consumidor faz sort/filter antes de passar.

#### 2.3 `src/hooks/useIsMobile.ts`

```ts
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);
  return isMobile;
}
```

---

### Fase 3 — `useConversations` hook (opcional)

#### 3.1 `src/conversations/useConversations.ts`

Hook standalone (sem TanStack Query). Usa `useState` + `useCallback` + `fetch`.

```ts
interface UseConversationsOptions {
  endpoint?: string;    // default: ""
  token?: string;       // Bearer token
  fetcher?: (url: string, init?: RequestInit) => Promise<Response>;  // override fetch
  autoFetch?: boolean;  // default: true
}

interface UseConversationsReturn {
  conversations: Conversation[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  create: (agentId: string) => Promise<Conversation>;
  rename: (id: string, title: string) => Promise<void>;
  star: (id: string, starred: boolean) => Promise<void>;   // optimistic update
  remove: (id: string) => Promise<void>;
  exportUrl: (id: string, format?: "json" | "markdown") => string;
}
```

Detalhes:
- Fetcher default adiciona `Authorization: Bearer ${token}` no header
- Paths: `/api/v1/ai/conversations/*` (mesmo padrao do Hub)
- `star()` faz update otimista (atualiza estado local, faz PATCH, rollback no erro)
- `remove()` remove do estado local apos DELETE bem-sucedido
- `create()` adiciona ao estado local apos POST bem-sucedido
- `exportUrl()` retorna URL com `?token=` para download direto

---

### Fase 4 — Componentes de conversas

#### 4.1 `src/conversations/CollapsibleGroup.tsx`

Componente interno (nao exportado diretamente). Extraido de `conversations-layout.tsx:54-81`.

```tsx
interface CollapsibleGroupProps {
  label: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}
```

Chevron rotaciona 90 graus quando aberto. Label em `text-xs font-medium text-muted-foreground`.

#### 4.2 `src/conversations/ConversationListItem.tsx`

Componente interno. Extraido de `conversations-layout.tsx:83-197`.

```tsx
interface ConversationListItemProps {
  conversation: Conversation;
  agentLabel?: string;
  isActive?: boolean;
  isRenaming?: boolean;
  renameValue?: string;
  onRenameChange?: (value: string) => void;
  onRenameCommit?: () => void;
  onRenameCancel?: () => void;
  onStartRename?: (e: React.MouseEvent) => void;
  onToggleStar?: (e: React.MouseEvent) => void;
  onClick?: () => void;
  badgesExtra?: React.ReactNode;  // slot para badges hub-specific (ex: operador)
  className?: string;
}
```

Layout:
- Star icon a esquerda (toggle amarelo quando starred)
- Area clicavel central: badges (agent + badgesExtra) + timestamp na primeira linha, titulo na segunda
- Pencil icon a direita (visivel no hover)
- Inline rename input (quando isRenaming=true)

#### 4.3 `src/conversations/ConversationList.tsx`

Componente principal da sidebar. **Totalmente controlado.**

```tsx
interface ConversationListProps {
  // Dados
  conversations: Conversation[];
  activeId?: string;
  isLoading?: boolean;

  // Busca
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;                    // default: "Search..."

  // Grupos (se nao fornecidos, deriva de conversations por starred)
  favorites?: Conversation[];
  history?: Conversation[];
  favoritesLabel?: string;                       // default: "Favorites"
  historyLabel?: string;                         // default: "History"

  // Paginacao
  hasMore?: boolean;
  onLoadMore?: () => void;
  loadMoreLabel?: string;                        // default: "Load more"
  remainingCount?: number;

  // Callbacks
  onSelect?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  onStar?: (id: string, starred: boolean) => void;
  onCreateRequest?: () => void;

  // Resolvers
  getAgentLabel?: (agentId: string) => string;

  // Slots de extensao
  headerExtra?: React.ReactNode;                 // entre busca e botao +
  filterExtra?: React.ReactNode;                 // abaixo do header (ex: agent Select)
  itemBadgesExtra?: (conv: Conversation) => React.ReactNode;

  // Empty state
  emptyIcon?: React.ReactNode;
  emptyTitle?: string;                           // default: "No conversations"
  emptyDescription?: string;                     // default: "Start a conversation to begin."

  // Layout
  className?: string;
}
```

Estado interno gerenciado pelo componente:
- `renamingId` / `renameValue` — qual item esta sendo renomeado e o valor do input
- `favoritesOpen` / `historyOpen` — estado dos CollapsibleGroup

Estrutura visual:
```
+----------------------------------+
| [Search...] [headerExtra] [+]    |
+----------------------------------+
| [filterExtra]                    |
+----------------------------------+
| > Favorites                      |
|   [ConversationListItem]         |
|   [ConversationListItem]         |
| > History                        |
|   [ConversationListItem]         |
|   [ConversationListItem]         |
|   [Load more (N remaining)]      |
+----------------------------------+
```

Loading state: 8 Skeletons de `h-16 w-full rounded-lg`.

Empty state: icone centralizado + titulo + descricao.

#### 4.4 `src/conversations/RenameDialog.tsx`

Componente interno. Dialog modal para renomear conversa.

```tsx
interface RenameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  isPending?: boolean;
  title?: string;           // default: "Rename conversation"
  placeholder?: string;     // default: "Conversation title"
  cancelLabel?: string;     // default: "Cancel"
  confirmLabel?: string;    // default: "Save"
}
```

Enter no input confirma. Botao desabilitado quando valor vazio ou isPending.

#### 4.5 `src/conversations/DeleteDialog.tsx`

Componente interno. Dialog de confirmacao para excluir.

```tsx
interface DeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
  title?: string;           // default: "Delete conversation"
  description?: string;     // default: "This conversation will be permanently removed."
  cancelLabel?: string;     // default: "Cancel"
  confirmLabel?: string;    // default: "Delete"
}
```

Botao de confirmar usa `variant="destructive"`.

#### 4.6 `src/conversations/ConversationBar.tsx`

Barra de contexto no topo do chat. **Totalmente controlado.**

```tsx
interface ConversationBarProps {
  // Dados
  title?: string;
  agentLabel?: string;
  isLoading?: boolean;

  // Acoes
  onRename?: (title: string) => void;
  onExport?: () => void;
  onDelete?: () => void;
  onBack?: () => void;                          // mostra seta voltar (mobile)

  // Estado dos dialogs (controlado externamente OU gerenciado internamente)
  // Se nao fornecidos, gerencia internamente
  renameOpen?: boolean;
  onRenameOpenChange?: (open: boolean) => void;
  deleteOpen?: boolean;
  onDeleteOpenChange?: (open: boolean) => void;

  // Pending states
  isPendingRename?: boolean;
  isPendingDelete?: boolean;

  // Labels
  renameLabel?: string;         // default: "Rename"
  exportLabel?: string;         // default: "Export"
  deleteLabel?: string;         // default: "Delete"
  untitledLabel?: string;       // default: "Untitled"

  // Slots de extensao
  actionsExtra?: React.ReactNode;      // antes do dropdown (ex: TakeoverButton)
  menuItemsExtra?: React.ReactNode;    // DropdownMenuItems extras
  afterBar?: React.ReactNode;          // abaixo da barra (ex: TakeoverBanner, Approvals)

  // Layout
  className?: string;
}
```

Estrutura visual:
```
+------------------------------------------------------+
| [<-] Titulo da conversa   [agent badge] [extras] [:]  |
+------------------------------------------------------+
| [afterBar]                                            |
```

O dropdown menu (`:`) contem: Renomear (Pencil), Exportar (Download), menuItemsExtra, Excluir (Trash2, text-destructive).

Se `renameOpen`/`onRenameOpenChange` nao sao fornecidos, o componente gerencia o estado dos dialogs internamente (uncontrolled mode). Se fornecidos, o consumidor controla (controlled mode).

Loading state: Skeleton no lugar do titulo.

---

### Fase 5 — Exports e integracao

#### 5.1 `src/conversations/index.ts`

Barrel export:
```ts
export { ConversationList } from "./ConversationList.js";
export type { ConversationListProps } from "./ConversationList.js";

export { ConversationBar } from "./ConversationBar.js";
export type { ConversationBarProps } from "./ConversationBar.js";

export { useConversations } from "./useConversations.js";
export type { UseConversationsOptions, UseConversationsReturn } from "./useConversations.js";

export { useIsMobile } from "../hooks/useIsMobile.js";

export { formatRelativeTime, buildInitialMessages, groupConversations } from "./utils.js";

export type { Conversation, BackendMessage } from "./types.js";
```

#### 5.2 Atualizar `src/index.ts`

Adicionar re-exports:
```ts
// Conversation management
export {
  ConversationList,
  ConversationBar,
  useConversations,
  useIsMobile,
  formatRelativeTime,
  buildInitialMessages,
  groupConversations,
} from "./conversations/index.js";

export type {
  ConversationListProps,
  ConversationBarProps,
  UseConversationsOptions,
  UseConversationsReturn,
  Conversation,
  BackendMessage,
} from "./conversations/index.js";
```

---

### Fase 6 — Refactor do Hub

#### 6.1 `apps/hub/src/components/conversations/conversations-layout.tsx`

De ~565 linhas para ~120 linhas:

```tsx
import { ConversationList, groupConversations } from "@codrstudio/agentic-chat";

export function ConversationsLayout({ fixedAgentId, basePath }: ConversationsLayoutProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  // ... estado local: search, agentFilter, operatorFilter, historyLimit ...

  const { data: conversations, isLoading } = useQuery(conversationsQueryOptions());
  const { data: agents } = useQuery(agentsQueryOptions());

  // Mutations (rename, star, create) — mantidos no Hub via TanStack Query
  const renameMutation = useMutation({ ... });
  const starMutation = useMutation({ ... }); // com optimistic update
  const createMutation = useMutation({ ... });

  // Filtering (hub-specific: agent filter + operator filter)
  const filtered = useMemo(() => { ... }, [conversations, search, agentFilter, operatorFilter]);
  const { favorites, history } = groupConversations(filtered);
  const visibleHistory = history.slice(0, historyLimit);

  return (
    <div className="flex h-[calc(100vh-theme(spacing.14)-2rem)] overflow-hidden">
      {showList && (
        <ConversationList
          conversations={filtered}
          favorites={favorites}
          history={visibleHistory}
          activeId={activeId}
          isLoading={loadingConversations}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar..."
          favoritesLabel="Favoritos"
          historyLabel="Historico"
          onSelect={(id) => navigate({ to: `${basePath}/${id}` })}
          onRename={(id, title) => renameMutation.mutate({ id, title })}
          onStar={(id, starred) => starMutation.mutate({ id, starred })}
          onCreateRequest={handleNewConversation}
          getAgentLabel={(agentId) => getAgentLabel(agents, agentId)}
          hasMore={history.length > historyLimit}
          onLoadMore={() => setHistoryLimit((l) => l + PAGE_SIZE)}
          remainingCount={history.length - historyLimit}
          loadMoreLabel="Carregar mais"
          emptyTitle="Nenhuma conversa"
          emptyDescription="Inicie uma conversa com um agente."
          headerExtra={
            <Button variant={operatorFilter ? "default" : "ghost"} size="icon" className="size-8 shrink-0"
              onClick={() => setOperatorFilter((v) => !v)} title="Filtrar com operador">
              <User className="size-3.5" />
            </Button>
          }
          filterExtra={!fixedAgentId && filterAgents.length > 1 && <AgentFilterSelect ... />}
          itemBadgesExtra={(conv) =>
            conv.metadata?.takeover_by ? (
              <Badge variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
                <User className="mr-0.5 size-2.5" /> Op
              </Badge>
            ) : null
          }
          className={cn(isMobile ? "w-full" : "w-80")}
        />
      )}
      {showOutlet && <main className="flex-1 overflow-hidden"><Outlet /></main>}
      {/* New conversation dialog permanece no Hub (agent selector) */}
    </div>
  );
}
```

**Removido do arquivo**: `CollapsibleGroup`, `ConversationListItem`, `formatRelativeTime`, `getAgentLabel` (refatorado), toda a logica de rename inline, toda a renderizacao de items.

#### 6.2 `apps/hub/src/components/conversations/conversation-chat.tsx`

De ~460 linhas para ~100 linhas:

```tsx
import { ConversationBar, buildInitialMessages } from "@codrstudio/agentic-chat";
import { Chat } from "@codrstudio/agentic-chat";

export function ConversationChatPage({ id, basePath }: ConversationChatPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const { data: conversation, isLoading: convLoading } = useQuery(conversationQueryOptions(id));
  const { data: agents } = useQuery(agentsQueryOptions());
  const { data: session } = useQuery(sessionQueryOptions(id));
  const { data: existingMessages, isLoading: msgsLoading } = useQuery(conversationMessagesQueryOptions(id));

  const renameMutation = useMutation({ ... });
  const deleteMutation = useMutation({ ... });
  const takeoverMutation = useMutation({ ... });
  const releaseMutation = useMutation({ ... });

  const agentLabel = agents?.find((a) => a.id === conversation?.agentId)?.slug ?? "";
  const token = useAuthStore.getState().token ?? "";
  const isUnderTakeover = session?.takeover_by != null;

  if (convLoading || msgsLoading) return <LoadingSkeleton />;
  if (!conversation) return <NotFound basePath={basePath} />;

  return (
    <div className="chat-active flex h-full gap-3">
      <div className="flex flex-1 flex-col overflow-hidden">
        <ConversationBar
          title={conversation.title}
          agentLabel={agentLabel}
          onRename={(title) => renameMutation.mutate(title)}
          onExport={handleExport}
          onDelete={() => deleteMutation.mutate()}
          onBack={isMobile ? () => navigate({ to: basePath }) : undefined}
          isPendingRename={renameMutation.isPending}
          isPendingDelete={deleteMutation.isPending}
          renameLabel="Renomear"
          exportLabel="Exportar"
          deleteLabel="Excluir"
          untitledLabel="Sem titulo"
          actionsExtra={!isUnderTakeover && <TakeoverButton ... />}
          menuItemsExtra={null}
          afterBar={
            <>
              {isUnderTakeover && session?.takeover_by && session?.takeover_at && (
                <TakeoverBanner ... />
              )}
              <ApprovalInlineActions sessionId={id} />
            </>
          }
        />
        <Chat
          endpoint=""
          token={token}
          sessionId={id}
          initialMessages={buildInitialMessages(existingMessages)}
          className="flex-1 flex flex-col overflow-hidden"
        />
      </div>
      {/* Orchestration sidebar permanece no Hub */}
      {orchestrationPath.length > 0 && <OrchestrationSidebar path={orchestrationPath} />}
    </div>
  );
}
```

**Removido do arquivo**: `buildInitialMessages` (importado do agentic-chat), `RenameDialog` inline, `DeleteDialog` inline, header bar manual, dropdown menu manual.

#### 6.3 `apps/hub/src/api/conversations.ts`

Ajustar `sessionToConversation` para incluir `metadata`:

```ts
function sessionToConversation(s: Session): Conversation & { takeover_by: string | null; takeover_at: string | null } {
  return {
    id: s.session_id,
    agentId: s.agent_id,
    title: s.title ?? undefined,
    updatedAt: s.updated_at,
    starred: s.starred === 1,
    takeover_by: s.takeover_by,
    takeover_at: s.takeover_at,
    metadata: {
      takeover_by: s.takeover_by,
      takeover_at: s.takeover_at,
    },
  };
}
```

---

## Limites

### NAO fazer

- NAO criar `ConversationLayout` composto — consumidores compoem como quiserem
- NAO acoplar componentes a TanStack Router/Query — devem funcionar com qualquer framework
- NAO mover TakeoverButton/TakeoverBanner/ApprovalInlineActions para agentic-chat — sao hub-specific
- NAO adicionar logica de navegacao nos componentes — apenas callbacks
- NAO mudar a API do backend — componentes consomem a API existente
- NAO mudar a API publica do Chat/MessageList/MessageInput — sao independentes
- NAO criar agent selector no agentic-chat — cada app tem seu proprio fluxo de criacao

### Observacoes

- O `useConversations` hook usa fetch nativo. Consumidores com TanStack Query, SWR, ou Apollo ignoram o hook e passam dados diretamente para os componentes.
- Labels default em ingles. Hub override com pt-BR via props.
- `buildInitialMessages` tem tipagem generica (`BackendMessage`) — aceita qualquer objeto com `role`, `content`, `_meta`. O Hub's `ConversationMessage` ja conforma.
- Mobile responsiveness: componentes nao controlam show/hide. O consumidor decide quando renderizar cada componente. ConversationBar aceita `onBack` para mostrar seta de voltar.

---

## Ordem de Execucao

| Fase | O que | Arquivos | Depende de |
|---|---|---|---|
| 1 | Primitivos shadcn | `src/ui/input.tsx`, `src/ui/dropdown-menu.tsx`, `src/ui/skeleton.tsx` | nada |
| 2 | Tipos e utilitarios | `src/conversations/types.ts`, `src/conversations/utils.ts`, `src/hooks/useIsMobile.ts` | nada |
| 3 | Hook useConversations | `src/conversations/useConversations.ts` | fase 2 |
| 4 | Componentes | `CollapsibleGroup.tsx`, `ConversationListItem.tsx`, `RenameDialog.tsx`, `DeleteDialog.tsx`, `ConversationList.tsx`, `ConversationBar.tsx` | fases 1, 2 |
| 5 | Exports | `src/conversations/index.ts`, `src/index.ts` | fases 3, 4 |
| 6 | Hub refactor | `conversations-layout.tsx`, `conversation-chat.tsx`, `api/conversations.ts` | fase 5 |

Fases 1, 2 sao paralelas. Fases 3, 4 sao paralelas (ambas dependem de 1+2).

---

## Validacao

### Checklist funcional — agentic-chat

- [ ] `ConversationList` renderiza com dados mockados (favorites + history)
- [ ] Busca filtra por titulo (se consumidor implementar filtering)
- [ ] Star toggle dispara callback `onStar`
- [ ] Inline rename: double-click abre input, Enter confirma, Escape cancela
- [ ] Criar nova conversa dispara `onCreateRequest`
- [ ] Load more dispara `onLoadMore`
- [ ] Grupos Favoritos/Historico colapsam
- [ ] `ConversationBar` mostra titulo + agent badge
- [ ] Dropdown menu: Renomear abre dialog, Exportar dispara callback, Excluir abre dialog de confirmacao
- [ ] RenameDialog: Enter confirma, botao desabilitado quando vazio
- [ ] DeleteDialog: botao destructive, confirmacao
- [ ] `afterBar` slot renderiza conteudo abaixo da barra
- [ ] `actionsExtra` slot renderiza antes do dropdown
- [ ] Loading states com Skeleton
- [ ] Empty state com icone + mensagem
- [ ] `useConversations` hook: fetch lista, create, rename, star (optimistic), delete
- [ ] `buildInitialMessages` transforma mensagens backend para formato ai-sdk
- [ ] `formatRelativeTime` retorna strings relativas corretas
- [ ] Todos os componentes respeitam tokens shadcn (bg-background, text-foreground, etc.)

### Checklist funcional — Hub refactor

- [ ] Sidebar de conversas funciona identico ao atual
- [ ] Busca por titulo funciona
- [ ] Filtro por agente funciona
- [ ] Filtro por operador funciona
- [ ] Star/unstar com optimistic update funciona
- [ ] Inline rename na sidebar funciona
- [ ] Nova conversa (dialog com agent selector) funciona
- [ ] Barra de contexto mostra titulo + agente
- [ ] Menu: Renomear, Exportar, Excluir funcionam
- [ ] TakeoverButton aparece no slot `actionsExtra`
- [ ] TakeoverBanner aparece no slot `afterBar`
- [ ] ApprovalInlineActions aparece no slot `afterBar`
- [ ] Orchestration sidebar continua funcionando
- [ ] Mobile: sidebar esconde quando chat ativo, seta voltar funciona
- [ ] `npm run build` compila sem erro
- [ ] `npm run dev:all` funciona sem regressao

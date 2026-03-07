import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  RotateCcw,
  Eye,
  EyeOff,
  Plug,
  Plus,
  MoreVertical,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useReviewAgents,
  useReviewAgentDefaults,
  useUpdateReviewAgent,
  type ReviewAgent,
} from "@/hooks/use-review-agents-settings";
import type { ReviewAgentType } from "@/hooks/use-agent-review";
import {
  useMcpServers,
  useDeleteMcpServer,
  useConnectMcpServer,
  type McpServerConfig,
  type McpStatus,
} from "@/hooks/use-mcp-servers";
import { McpServerDialog } from "@/components/mcp-server-dialog";
import { GuardrailsSettings } from "@/components/guardrails-settings";

function AgentCard({
  agent,
  defaultAgent,
  onToggle,
  onUpdatePrompt,
  onRestore,
  isSaving,
}: {
  agent: ReviewAgent;
  defaultAgent: ReviewAgent | undefined;
  onToggle: (type: ReviewAgentType, enabled: boolean) => void;
  onUpdatePrompt: (type: ReviewAgentType, prompt: string) => void;
  onRestore: (type: ReviewAgentType) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [draft, setDraft] = useState(agent.system_prompt);

  const isModified = defaultAgent
    ? agent.system_prompt !== defaultAgent.system_prompt
    : false;

  const handleSavePrompt = () => {
    onUpdatePrompt(agent.type, draft);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(agent.system_prompt);
    setEditing(false);
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-5 text-muted-foreground" />
          <div>
            <h3 className="text-sm font-semibold">{agent.name}</h3>
            <p className="text-xs text-muted-foreground">{agent.description}</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={agent.enabled}
          disabled={isSaving}
          onClick={() => onToggle(agent.type, !agent.enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
            agent.enabled ? "bg-primary" : "bg-input"
          }`}
        >
          <span
            className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
              agent.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            System Prompt
            {isModified && (
              <span className="ml-1.5 text-yellow-600">(modificado)</span>
            )}
          </label>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setPreview(!preview)}
            >
              {preview ? (
                <EyeOff className="size-3 mr-1" />
              ) : (
                <Eye className="size-3 mr-1" />
              )}
              {preview ? "Editar" : "Preview"}
            </Button>
            {isModified && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground"
                disabled={isSaving}
                onClick={() => onRestore(agent.type)}
              >
                <RotateCcw className="size-3 mr-1" />
                Restaurar default
              </Button>
            )}
          </div>
        </div>

        {preview ? (
          <div className="rounded-md border bg-muted/50 p-3 text-sm whitespace-pre-wrap min-h-[80px]">
            {editing ? draft : agent.system_prompt}
          </div>
        ) : editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              className="text-sm"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSavePrompt}
                disabled={isSaving || draft === agent.system_prompt}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground cursor-pointer hover:bg-muted/50 transition-colors min-h-[80px] whitespace-pre-wrap"
            onClick={() => {
              setDraft(agent.system_prompt);
              setEditing(true);
            }}
          >
            {agent.system_prompt}
          </div>
        )}
      </div>
    </div>
  );
}

// --- MCP Servers Section ---

const STATUS_COLORS: Record<McpStatus, string> = {
  disconnected: "bg-gray-400",
  connecting: "bg-yellow-400 animate-pulse",
  connected: "bg-green-500",
  error: "bg-red-500",
};

const STATUS_LABELS: Record<McpStatus, string> = {
  disconnected: "Desconectado",
  connecting: "Conectando...",
  connected: "Conectado",
  error: "Erro",
};

function McpStatusDot({ status }: { status: McpStatus }) {
  return (
    <span
      className={`inline-block size-2.5 rounded-full ${STATUS_COLORS[status]}`}
      title={STATUS_LABELS[status]}
    />
  );
}

function McpServerCard({
  server,
  onEdit,
  onConnect,
  onDisconnect,
  onRemove,
  onClick,
  isActing,
}: {
  server: McpServerConfig;
  onEdit: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRemove: () => void;
  onClick: () => void;
  isActing: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className="rounded-lg border bg-card p-4 space-y-2 cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <McpStatusDot status={server.status} />
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{server.name}</h3>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {server.transport.toUpperCase()}
            </Badge>
          </div>
        </div>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            disabled={isActing}
          >
            {isActing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MoreVertical className="size-4" />
            )}
          </Button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                className="absolute right-0 top-full z-50 mt-1 w-44 rounded-md border bg-popover p-1 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit();
                  }}
                >
                  <Pencil className="size-3.5" />
                  Editar
                </button>
                {server.status === "connected" ? (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => {
                      setMenuOpen(false);
                      onDisconnect();
                    }}
                  >
                    <PowerOff className="size-3.5" />
                    Desconectar
                  </button>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => {
                      setMenuOpen(false);
                      onConnect();
                    }}
                  >
                    <Power className="size-3.5" />
                    Conectar
                  </button>
                )}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                  onClick={() => {
                    setMenuOpen(false);
                    onRemove();
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Remover
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {server.description && (
        <p className="text-xs text-muted-foreground pl-5.5">
          {server.description}
        </p>
      )}
      {server.status === "error" && server.last_error && (
        <p className="text-xs text-red-500 pl-5.5">{server.last_error}</p>
      )}
    </div>
  );
}

function McpServersSection({ projectSlug }: { projectSlug: string }) {
  const navigate = useNavigate();
  const { data: servers, isLoading } = useMcpServers(projectSlug);
  const deleteServer = useDeleteMcpServer(projectSlug);
  const connectServer = useConnectMcpServer(projectSlug);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<McpServerConfig | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<McpServerConfig | null>(null);

  const handleEdit = (server: McpServerConfig) => {
    setEditingServer(server);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingServer(undefined);
    setDialogOpen(true);
  };

  const handleConnect = (id: string) => {
    connectServer.mutate({ id, action: "connect" });
  };

  const handleDisconnect = (id: string) => {
    connectServer.mutate({ id, action: "disconnect" });
  };

  const handleConfirmDelete = () => {
    if (deleteTarget) {
      deleteServer.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Plug className="size-5" />
            <h2 className="text-base font-semibold">Integracoes (MCP)</h2>
          </div>
          <Button size="sm" onClick={handleAdd}>
            <Plus className="size-3.5 mr-1.5" />
            Adicionar server
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Gerencie MCP servers para integrar ferramentas e recursos externos ao
          projeto.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : servers && servers.length > 0 ? (
          <div className="space-y-3">
            {servers.map((server) => (
              <McpServerCard
                key={server.id}
                server={server}
                onEdit={() => handleEdit(server)}
                onConnect={() => handleConnect(server.id)}
                onDisconnect={() => handleDisconnect(server.id)}
                onRemove={() => setDeleteTarget(server)}
                onClick={() =>
                  navigate({
                    to: "/projects/$projectId/settings/mcp/$serverId",
                    params: { projectId: projectSlug, serverId: server.id },
                  })
                }
                isActing={
                  (connectServer.isPending &&
                    connectServer.variables?.id === server.id) ||
                  (deleteServer.isPending &&
                    deleteServer.variables === server.id)
                }
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <Plug className="size-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum MCP server configurado.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleAdd}
            >
              <Plus className="size-3.5 mr-1.5" />
              Adicionar primeiro server
            </Button>
          </div>
        )}
      </div>

      <McpServerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectSlug={projectSlug}
        server={editingServer}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover MCP Server</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o server &quot;{deleteTarget?.name}
              &quot;? Esta acao nao pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ProjectSettingsPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/settings",
  });

  const { data: agents, isLoading } = useReviewAgents(projectId);
  const { data: defaults } = useReviewAgentDefaults(projectId);
  const updateAgent = useUpdateReviewAgent(projectId);

  const handleToggle = (type: ReviewAgentType, enabled: boolean) => {
    updateAgent.mutate({ type, updates: { enabled } });
  };

  const handleUpdatePrompt = (type: ReviewAgentType, prompt: string) => {
    updateAgent.mutate({ type, updates: { system_prompt: prompt } });
  };

  const handleRestore = (type: ReviewAgentType) => {
    const def = defaults?.find((d) => d.type === type);
    if (def) {
      updateAgent.mutate({
        type,
        updates: { system_prompt: def.system_prompt },
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-lg font-semibold">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configuracoes do projeto
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5" />
            <h2 className="text-base font-semibold">Review Agents</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure os agentes de review AI. Habilite ou desabilite agentes e
            customize seus prompts.
          </p>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {agents?.map((agent) => (
                <AgentCard
                  key={agent.type}
                  agent={agent}
                  defaultAgent={defaults?.find((d) => d.type === agent.type)}
                  onToggle={handleToggle}
                  onUpdatePrompt={handleUpdatePrompt}
                  onRestore={handleRestore}
                  isSaving={updateAgent.isPending}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t pt-6">
          <GuardrailsSettings projectSlug={projectId} />
        </div>

        <div className="border-t pt-6">
          <McpServersSection projectSlug={projectId} />
        </div>
      </div>
    </div>
  );
}

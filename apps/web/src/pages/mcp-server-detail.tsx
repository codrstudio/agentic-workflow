import { useState } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Wrench,
  FileText,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  CheckCircle,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMcpServers,
  useMcpServerTools,
  useMcpServerResources,
  useImportMcpResource,
  type McpTool,
  type McpResource,
  type McpStatus,
} from "@/hooks/use-mcp-servers";

// --- Status helpers ---

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

// --- JSON Tree (collapsible) ---

function JsonTree({ data, defaultOpen = false }: { data: unknown; defaultOpen?: boolean }) {
  if (data === null || data === undefined) {
    return <span className="text-muted-foreground">null</span>;
  }

  if (typeof data !== "object") {
    if (typeof data === "string") {
      return <span className="text-green-600 dark:text-green-400">&quot;{data}&quot;</span>;
    }
    if (typeof data === "boolean") {
      return <span className="text-blue-600 dark:text-blue-400">{String(data)}</span>;
    }
    return <span className="text-amber-600 dark:text-amber-400">{String(data)}</span>;
  }

  const isArray = Array.isArray(data);
  const entries = isArray
    ? (data as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(data as Record<string, unknown>);

  if (entries.length === 0) {
    return <span className="text-muted-foreground">{isArray ? "[]" : "{}"}</span>;
  }

  return <JsonNode entries={entries} isArray={isArray} defaultOpen={defaultOpen} />;
}

function JsonNode({
  entries,
  isArray,
  defaultOpen,
}: {
  entries: readonly (readonly [string, unknown])[];
  isArray: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!open) {
    return (
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <ChevronRight className="size-3" />
        {isArray ? `[${entries.length}]` : `{${entries.length}}`}
      </button>
    );
  }

  return (
    <div className="text-xs font-mono">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(false)}
      >
        <ChevronDown className="size-3" />
        {isArray ? "[" : "{"}
      </button>
      <div className="ml-4 border-l border-border pl-2 space-y-0.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start gap-1">
            {!isArray && <span className="text-purple-600 dark:text-purple-400">{key}:</span>}
            <JsonTree data={value} />
          </div>
        ))}
      </div>
      <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>
    </div>
  );
}

// --- Tool Card ---

function ToolCard({ tool }: { tool: McpTool }) {
  const [schemaOpen, setSchemaOpen] = useState(false);
  const hasSchema =
    tool.inputSchema &&
    typeof tool.inputSchema === "object" &&
    Object.keys(tool.inputSchema).length > 0;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold font-mono">{tool.name}</h3>
        </div>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
          <MessageSquare className="size-2.5" />
          Disponivel no chat
        </Badge>
      </div>
      {tool.description && (
        <p className="text-xs text-muted-foreground">{tool.description}</p>
      )}
      {hasSchema && (
        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSchemaOpen(!schemaOpen)}
          >
            {schemaOpen ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
            Input Schema
          </button>
          {schemaOpen && (
            <div className="mt-2 rounded-md border bg-muted/30 p-3 overflow-x-auto">
              <JsonTree data={tool.inputSchema} defaultOpen />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Resource Card ---

function ResourceCard({
  resource,
  onImport,
  isImporting,
  isImported,
}: {
  resource: McpResource;
  onImport: (uri: string) => void;
  isImporting: boolean;
  isImported: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{resource.name}</h3>
        </div>
        {isImported ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1 text-green-600">
            <CheckCircle className="size-2.5" />
            Importado
          </Badge>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onImport(resource.uri)}
            disabled={isImporting}
          >
            {isImporting ? (
              <Loader2 className="size-3 mr-1.5 animate-spin" />
            ) : (
              <Download className="size-3 mr-1.5" />
            )}
            Importar como Source
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="font-mono truncate">{resource.uri}</span>
        {resource.mimeType && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
            {resource.mimeType}
          </Badge>
        )}
      </div>
      {resource.description && (
        <p className="text-xs text-muted-foreground">{resource.description}</p>
      )}
    </div>
  );
}

// --- Tools Tab ---

function ToolsTab({ projectSlug, serverId }: { projectSlug: string; serverId: string }) {
  const { data: tools, isLoading, error } = useMcpServerTools(projectSlug, serverId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Nao foi possivel carregar tools. O server pode estar desconectado.
        </p>
      </div>
    );
  }

  if (!tools || tools.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Wrench className="size-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhuma tool descoberta neste server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tools.map((tool) => (
        <ToolCard key={tool.name} tool={tool} />
      ))}
    </div>
  );
}

// --- Resources Tab ---

function ResourcesTab({ projectSlug, serverId }: { projectSlug: string; serverId: string }) {
  const { data: resources, isLoading, error } = useMcpServerResources(projectSlug, serverId);
  const importResource = useImportMcpResource(projectSlug, serverId);
  const [importedUris, setImportedUris] = useState<Set<string>>(new Set());
  const [importingUri, setImportingUri] = useState<string | null>(null);

  const handleImport = async (uri: string) => {
    setImportingUri(uri);
    try {
      await importResource.mutateAsync(uri);
      setImportedUris((prev) => new Set(prev).add(uri));
    } finally {
      setImportingUri(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Nao foi possivel carregar resources. O server pode estar desconectado.
        </p>
      </div>
    );
  }

  if (!resources || resources.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <FileText className="size-8 mx-auto text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground">
          Nenhum resource descoberto neste server.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {resources.map((resource) => (
        <ResourceCard
          key={resource.uri}
          resource={resource}
          onImport={handleImport}
          isImporting={importingUri === resource.uri}
          isImported={importedUris.has(resource.uri)}
        />
      ))}
    </div>
  );
}

// --- Main Page ---

type Tab = "tools" | "resources";

export function McpServerDetailPage() {
  const { projectId, serverId } = useParams({
    from: "/_authenticated/projects/$projectId/settings/mcp/$serverId",
  });
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("tools");

  const { data: servers, isLoading } = useMcpServers(projectId);
  const server = servers?.find((s) => s.id === serverId);

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!server) {
    return (
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <p className="text-sm text-muted-foreground">Server nao encontrado.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() =>
              navigate({
                to: "/projects/$projectId/settings",
                params: { projectId },
              })
            }
          >
            <ArrowLeft className="size-3.5 mr-1.5" />
            Voltar para Settings
          </Button>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof Wrench }[] = [
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "resources", label: "Resources", icon: FileText },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-2 -ml-2 text-muted-foreground"
          onClick={() =>
            navigate({
              to: "/projects/$projectId/settings",
              params: { projectId },
            })
          }
        >
          <ArrowLeft className="size-3.5 mr-1.5" />
          Settings
        </Button>

        {/* Header */}
        <div className="rounded-lg border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span
                className={`inline-block size-3 rounded-full ${STATUS_COLORS[server.status]}`}
                title={STATUS_LABELS[server.status]}
              />
              <h1 className="text-lg font-semibold">{server.name}</h1>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {server.transport.toUpperCase()}
              </Badge>
              <Badge
                variant={server.status === "connected" ? "default" : "secondary"}
                className="text-xs"
              >
                {STATUS_LABELS[server.status]}
              </Badge>
            </div>
          </div>
          {server.description && (
            <p className="text-sm text-muted-foreground">{server.description}</p>
          )}
          {server.status === "error" && server.last_error && (
            <p className="text-xs text-red-500">{server.last_error}</p>
          )}
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="size-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === "tools" ? (
          <ToolsTab projectSlug={projectId} serverId={serverId} />
        ) : (
          <ResourcesTab projectSlug={projectId} serverId={serverId} />
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import {
  Network,
  ArrowLeft,
  Save,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  CircleDashed,
  Clock,
  X,
  Plus,
} from "lucide-react";
import {
  useGraphConfig,
  usePatchGraphConfig,
  useStartIndexing,
  subscribeIndexEvents,
  graphConfigKeys,
} from "@/hooks/use-graph-config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

const providerLabels: Record<string, string> = {
  gitnexus: "GitNexus",
  graphiti: "Graphiti",
  custom_mcp: "Custom MCP",
};

const providerColors: Record<string, string> = {
  gitnexus: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  graphiti: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  custom_mcp: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atras`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d atras`;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function TagsInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput("");
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Pressione Enter para adicionar"}
        className="text-sm"
      />
    </div>
  );
}

function ChipsInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!value.includes(input.trim())) {
        onChange([...value, input.trim()]);
      }
      setInput("");
    }
  };

  const removeChip = (chip: string) => {
    onChange(value.filter((c) => c !== chip));
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1 mb-1.5">
        {value.map((chip) => (
          <Badge key={chip} variant="outline" className="gap-1 text-xs">
            {chip}
            <button
              type="button"
              onClick={() => removeChip(chip)}
              className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Pressione Enter para adicionar"}
        className="text-sm"
      />
    </div>
  );
}

export function GraphConfigPage() {
  const { projectId, sourceId } = useParams({
    from: "/_authenticated/projects/$projectId/sources/$sourceId/graph-config",
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: config, isLoading, isError, error } = useGraphConfig(projectId, sourceId);
  const patchConfig = usePatchGraphConfig(projectId, sourceId);
  const startIndexing = useStartIndexing(projectId, sourceId);

  // Form state
  const [mcpServerUrl, setMcpServerUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [mcpTools, setMcpTools] = useState<string[]>([]);
  const [indexPatterns, setIndexPatterns] = useState<string[]>([]);
  const [excludePatterns, setExcludePatterns] = useState<string[]>([]);
  const [autoReindex, setAutoReindex] = useState(true);

  // SSE indexing state
  const [nodesIndexed, setNodesIndexed] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // Populate form when config loads
  useEffect(() => {
    if (config) {
      setMcpServerUrl(config.mcp_server_url);
      setAuthToken(config.mcp_auth_token ?? "");
      setMcpTools(config.mcp_tools);
      setIndexPatterns(config.index_patterns);
      setExcludePatterns(config.exclude_patterns);
      setAutoReindex(config.auto_reindex_on_merge);
    }
  }, [config]);

  const handleSubscribeSSE = useCallback(() => {
    if (controllerRef.current) controllerRef.current.abort();
    setIsSubscribed(true);
    setNodesIndexed(0);

    const ctrl = subscribeIndexEvents(projectId, sourceId, {
      onProgress: (count) => setNodesIndexed(count),
      onComplete: () => {
        setIsSubscribed(false);
        setNodesIndexed(null);
        queryClient.invalidateQueries({
          queryKey: graphConfigKeys.detail(projectId, sourceId),
        });
      },
      onError: () => {
        setIsSubscribed(false);
        setNodesIndexed(null);
        queryClient.invalidateQueries({
          queryKey: graphConfigKeys.detail(projectId, sourceId),
        });
      },
    });
    controllerRef.current = ctrl;
  }, [projectId, sourceId, queryClient]);

  // Auto-subscribe when indexing
  useEffect(() => {
    if (config?.index_status === "indexing" && !isSubscribed) {
      handleSubscribeSSE();
    }
  }, [config?.index_status, isSubscribed, handleSubscribeSSE]);

  // Cleanup
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const handleSave = () => {
    patchConfig.mutate({
      mcp_server_url: mcpServerUrl,
      mcp_auth_token: authToken || undefined,
      mcp_tools: mcpTools,
      index_patterns: indexPatterns,
      exclude_patterns: excludePatterns,
      auto_reindex_on_merge: autoReindex,
    });
  };

  const handleStartIndexing = () => {
    startIndexing.mutate(undefined, {
      onSuccess: () => handleSubscribeSSE(),
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-4 sm:p-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load graph config: {error.message}
        </div>
      </div>
    );
  }

  if (!config) return null;

  const indexStatus = config.index_status;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate({
              to: "/projects/$projectId/sources",
              params: { projectId },
            })
          }
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/40">
          <Network className="h-5 w-5 text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">
            Configuracao do Codebase Graph
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge
              className={cn(
                "text-xs",
                providerColors[config.provider] ?? providerColors.custom_mcp,
              )}
            >
              {providerLabels[config.provider] ?? config.provider}
            </Badge>
          </div>
        </div>
      </div>

      {/* Indexing Status Section */}
      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Status de Indexacao</h2>

        {/* Indexing in progress */}
        {(indexStatus === "indexing" || isSubscribed) && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
              <RotateCw className="h-4 w-4 animate-spin" />
              Indexando...{nodesIndexed != null ? ` ${nodesIndexed} nos processados` : ""}
            </div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all animate-pulse"
                style={{ width: "60%" }}
              />
            </div>
          </div>
        )}

        {/* Ready */}
        {indexStatus === "ready" && !isSubscribed && (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              Indexado com sucesso
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md bg-muted p-2">
                <div className="text-lg font-bold text-foreground">
                  {config.node_count?.toLocaleString() ?? "-"}
                </div>
                <div className="text-xs text-muted-foreground">Nos</div>
              </div>
              <div className="rounded-md bg-muted p-2">
                <div className="text-lg font-bold text-foreground">
                  {config.edge_count?.toLocaleString() ?? "-"}
                </div>
                <div className="text-xs text-muted-foreground">Arestas</div>
              </div>
              <div className="rounded-md bg-muted p-2">
                <div className="text-xs text-muted-foreground mt-1">Ultimo index</div>
                <div className="text-sm font-medium text-foreground">
                  {config.last_indexed_at
                    ? formatRelativeDate(config.last_indexed_at)
                    : "-"}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {indexStatus === "error" && !isSubscribed && (
          <div className="flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Erro na indexacao</div>
              {config.index_error && (
                <div className="mt-1 text-xs opacity-80">{config.index_error}</div>
              )}
            </div>
          </div>
        )}

        {/* Idle */}
        {indexStatus === "idle" && !isSubscribed && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleDashed className="h-4 w-4" />
            Nao indexado
          </div>
        )}
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="mcp-url">URL do servidor MCP</Label>
          <Input
            id="mcp-url"
            type="url"
            value={mcpServerUrl}
            onChange={(e) => setMcpServerUrl(e.target.value)}
            placeholder="http://localhost:7474"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="auth-token">Auth token</Label>
          <Input
            id="auth-token"
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <ChipsInput
          label="Ferramentas MCP"
          value={mcpTools}
          onChange={setMcpTools}
          placeholder="Nome da ferramenta + Enter"
        />

        <TagsInput
          label="Padroes de indexacao"
          value={indexPatterns}
          onChange={setIndexPatterns}
          placeholder="Ex: **/*.ts + Enter"
        />

        <TagsInput
          label="Padroes excluidos"
          value={excludePatterns}
          onChange={setExcludePatterns}
          placeholder="Ex: node_modules/** + Enter"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={autoReindex}
            onClick={() => setAutoReindex(!autoReindex)}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              autoReindex ? "bg-primary" : "bg-muted",
            )}
          >
            <span
              className={cn(
                "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
                autoReindex ? "translate-x-4" : "translate-x-0",
              )}
            />
          </button>
          <Label className="cursor-pointer" onClick={() => setAutoReindex(!autoReindex)}>
            Reindexar automaticamente apos merge
          </Label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={patchConfig.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {patchConfig.isPending ? "Salvando..." : "Salvar"}
        </Button>
        <Button
          variant="outline"
          onClick={handleStartIndexing}
          disabled={startIndexing.isPending || indexStatus === "indexing" || isSubscribed}
        >
          <RotateCw
            className={cn(
              "mr-1.5 h-4 w-4",
              (startIndexing.isPending || indexStatus === "indexing") && "animate-spin",
            )}
          />
          Iniciar indexacao
        </Button>
      </div>
    </div>
  );
}

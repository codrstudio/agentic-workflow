import { useState, useEffect, useCallback, useRef } from "react";
import { Network, RotateCw, AlertCircle, CheckCircle2, Clock, CircleDashed } from "lucide-react";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { Source } from "@/hooks/use-sources";
import { useGraphConfig, useStartIndexing, subscribeIndexEvents } from "@/hooks/use-graph-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { graphConfigKeys } from "@/hooks/use-graph-config";

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

function formatNodeCount(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  }
  return String(count);
}

interface IndexStatusBadgeProps {
  status: "idle" | "indexing" | "ready" | "error";
  nodeCount: number | null;
  nodesIndexed: number | null;
}

function IndexStatusBadge({ status, nodeCount, nodesIndexed }: IndexStatusBadgeProps) {
  switch (status) {
    case "indexing":
      return (
        <Badge
          variant="outline"
          className="border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 animate-pulse"
        >
          <RotateCw className="mr-1 h-3 w-3 animate-spin" />
          Indexando...{nodesIndexed != null ? ` (${nodesIndexed})` : ""}
        </Badge>
      );
    case "ready":
      return (
        <Badge
          variant="outline"
          className="border-green-400 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400"
        >
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Pronto{nodeCount != null ? ` (${formatNodeCount(nodeCount)} nos)` : ""}
        </Badge>
      );
    case "error":
      return (
        <Badge
          variant="outline"
          className="border-red-400 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400"
        >
          <AlertCircle className="mr-1 h-3 w-3" />
          Erro
        </Badge>
      );
    case "idle":
    default:
      return (
        <Badge
          variant="outline"
          className="border-gray-300 bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400"
        >
          <CircleDashed className="mr-1 h-3 w-3" />
          Nao indexado
        </Badge>
      );
  }
}

const providerLabels: Record<string, string> = {
  gitnexus: "GitNexus",
  graphiti: "Graphiti",
  custom_mcp: "Custom MCP",
};

interface CodebaseGraphSourceCardProps {
  source: Source;
  className?: string;
}

export function CodebaseGraphSourceCard({ source, className }: CodebaseGraphSourceCardProps) {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: graphConfig } = useGraphConfig(projectId, source.id);
  const startIndexing = useStartIndexing(projectId, source.id);

  const [nodesIndexed, setNodesIndexed] = useState<number | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const effectiveStatus = graphConfig?.index_status ?? "idle";

  const handleSubscribeSSE = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    setIsSubscribed(true);
    setNodesIndexed(0);

    const ctrl = subscribeIndexEvents(projectId, source.id, {
      onProgress: (count) => setNodesIndexed(count),
      onComplete: () => {
        setIsSubscribed(false);
        setNodesIndexed(null);
        queryClient.invalidateQueries({
          queryKey: graphConfigKeys.detail(projectId, source.id),
        });
      },
      onError: () => {
        setIsSubscribed(false);
        setNodesIndexed(null);
        queryClient.invalidateQueries({
          queryKey: graphConfigKeys.detail(projectId, source.id),
        });
      },
    });
    controllerRef.current = ctrl;
  }, [projectId, source.id, queryClient]);

  // Auto-subscribe when status is indexing
  useEffect(() => {
    if (effectiveStatus === "indexing" && !isSubscribed) {
      handleSubscribeSSE();
    }
  }, [effectiveStatus, isSubscribed, handleSubscribeSSE]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  const handleReindex = (e: React.MouseEvent) => {
    e.stopPropagation();
    startIndexing.mutate(undefined, {
      onSuccess: () => {
        handleSubscribeSSE();
      },
    });
  };

  const handleNavigateConfig = () => {
    navigate({
      to: "/projects/$projectId/sources/$sourceId/graph-config",
      params: { projectId, sourceId: source.id },
    });
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {/* Clickable area */}
      <button
        type="button"
        onClick={handleNavigateConfig}
        className="flex flex-col gap-2.5 text-left"
      >
        {/* Header: graph icon + name + provider */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 dark:bg-violet-900/40">
            <Network className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary transition-colors">
              {source.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">Codebase Graph</span>
              {graphConfig && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {providerLabels[graphConfig.provider] ?? graphConfig.provider}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="flex items-center gap-2">
          <IndexStatusBadge
            status={effectiveStatus}
            nodeCount={graphConfig?.node_count ?? null}
            nodesIndexed={isSubscribed ? nodesIndexed : null}
          />
        </div>

        {/* Progress bar during indexing */}
        {(effectiveStatus === "indexing" || isSubscribed) && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-amber-400 animate-pulse" style={{ width: "60%" }} />
          </div>
        )}

        {/* Last reindex date */}
        {graphConfig?.last_indexed_at && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Ultimo reindex: {formatRelativeDate(graphConfig.last_indexed_at)}
          </div>
        )}
      </button>

      {/* Reindex button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleReindex}
        disabled={startIndexing.isPending || effectiveStatus === "indexing"}
        className="w-full"
      >
        <RotateCw className={cn("mr-1.5 h-3.5 w-3.5", startIndexing.isPending && "animate-spin")} />
        Reindexar agora
      </Button>
    </div>
  );
}

export function CodebaseGraphSourceCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-5 w-28 rounded-full" />
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-8 w-full rounded-md" />
    </div>
  );
}

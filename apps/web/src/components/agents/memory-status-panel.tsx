import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Layers, Brain, RefreshCw, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  agentMemoryStatusQueryOptions,
  agentFileQueryOptions,
  syncAgentMemory,
  resetAgentMemory,
} from "@/api/agents";
import type { MemoryStatus } from "@/api/agents";
import { MemorySearchBox } from "./memory-search-box";

interface MemoryStatusPanelProps {
  agentId: string;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours}h`;
  const days = Math.floor(hours / 24);
  return `ha ${days}d`;
}

function isContentEmpty(content: string): boolean {
  const stripped = content
    .replace(/^---[\s\S]*?---\s*/m, "")
    .replace(/^#+\s*$/gm, "")
    .replace(/^[-*]\s*$/gm, "")
    .replace(/^\s*$/gm, "")
    .trim();
  return stripped.length === 0;
}

export function MemoryStatusPanel({ agentId }: MemoryStatusPanelProps) {
  const queryClient = useQueryClient();
  const { data: status, isLoading: statusLoading } = useQuery(
    agentMemoryStatusQueryOptions(agentId),
  );
  const { data: memoryFile, isLoading: fileLoading } = useQuery({
    ...agentFileQueryOptions(agentId, "MEMORY.md"),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncAgentMemory(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "memory", "status"] });
      toast.success("Memoria sincronizada");
    },
    onError: () => {
      toast.error("Erro ao sincronizar memoria");
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => resetAgentMemory(agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId, "memory"] });
      toast.success("Memoria resetada");
    },
    onError: () => {
      toast.error("Erro ao resetar memoria");
    },
  });

  return (
    <div className="space-y-6">
      {/* Status cards */}
      {statusLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : status ? (
        <StatusCards
          status={status}
          onSync={() => syncMutation.mutate()}
          syncing={syncMutation.isPending}
          onReset={() => resetMutation.mutate()}
          resetting={resetMutation.isPending}
        />
      ) : null}

      {/* MEMORY.md viewer */}
      {fileLoading ? (
        <Skeleton className="h-48" />
      ) : memoryFile && !isContentEmpty(memoryFile.content) ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Fatos Aprendidos
            </CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <Markdown>{memoryFile.content}</Markdown>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Fatos Aprendidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={<Brain />}
              title="Nenhum fato aprendido ainda"
              description="O agente extrai fatos automaticamente a cada 20 mensagens de conversa."
            />
          </CardContent>
        </Card>
      )}

      {/* Busca Semantica */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Busca Semantica
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MemorySearchBox agentId={agentId} />
        </CardContent>
      </Card>
    </div>
  );
}

interface StatusCardsProps {
  status: MemoryStatus;
  onSync: () => void;
  syncing: boolean;
  onReset: () => void;
  resetting: boolean;
}

function StatusCards({ status, onSync, syncing, onReset, resetting }: StatusCardsProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Arquivos indexados
            </CardTitle>
            <FileText className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(status.fileCount)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Chunks</CardTitle>
            <Layers className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatNumber(status.chunkCount)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {status.lastSync
            ? `Ultima sincronizacao: ${formatRelativeTime(status.lastSync)}`
            : "Nunca sincronizado"}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={syncing || resetting}
          >
            <RefreshCw className={`size-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar"}
          </Button>
          <ConfirmDialog
            title="Limpar Memoria"
            description="Todos os fatos e chunks da memoria do agente serao removidos. O MEMORY.md sera mantido. Esta acao eh irreversivel."
            onConfirm={onReset}
            destructive
          >
            <Button
              variant="destructive"
              size="sm"
              disabled={syncing || resetting}
            >
              <Trash2 className="size-4 mr-1" />
              {resetting ? "Limpando..." : "Limpar Memoria"}
            </Button>
          </ConfirmDialog>
        </div>
      </div>
    </div>
  );
}

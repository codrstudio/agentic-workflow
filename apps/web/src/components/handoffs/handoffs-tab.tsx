import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, GitMerge, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { handoffsQueryOptions, updateHandoff } from "@/api/handoffs";
import type { Handoff } from "@/api/handoffs";
import { agentQueryOptions } from "@/api/agents";
import { HandoffCard } from "@/components/handoffs/handoff-card";
import { HandoffCreateDialog } from "@/components/handoffs/handoff-create-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface HandoffsTabProps {
  agentId: string;
}

export function HandoffsTab({ agentId }: HandoffsTabProps) {
  const queryClient = useQueryClient();
  const { data: agent } = useQuery(agentQueryOptions(agentId));
  const { data: handoffs, isLoading } = useQuery(handoffsQueryOptions(agentId));
  const [createOpen, setCreateOpen] = useState(false);
  const [items, setItems] = useState<Handoff[] | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const isSupervisor = agent?.role === "supervisor";
  const displayItems = items ?? handoffs ?? [];

  const reorderMutation = useMutation({
    mutationFn: async (reordered: Handoff[]) => {
      await Promise.all(
        reordered.map((h, idx) =>
          updateHandoff(agentId, h.id, { priority: idx }),
        ),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoffs", agentId] });
      setItems(null);
    },
    onError: () => {
      toast.error("Erro ao reordenar handoffs");
      setItems(null);
    },
  });

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === index) return;
    const next = [...displayItems];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(index, 0, moved);
    dragIndexRef.current = index;
    setItems(next);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDragEnd() {
    dragIndexRef.current = null;
    if (items) {
      reorderMutation.mutate(items);
    }
  }

  return (
    <div className="space-y-4">
      {!isSupervisor && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Este agente nao tem <code className="font-mono text-xs">role: supervisor</code> no AGENT.md.
            Handoffs so funcionam em agentes supervisores.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Handoffs configurados</h3>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 size-4" />
          Adicionar handoff
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <EmptyState
          icon={<GitMerge />}
          title="Nenhum handoff configurado"
          description="Adicione handoffs para que este supervisor delegue mensagens a agentes especialistas."
        />
      ) : (
        <div className="space-y-2">
          {displayItems.map((handoff, index) => (
            <HandoffCard
              key={handoff.id}
              handoff={handoff}
              agentId={agentId}
              isDragging={dragIndexRef.current === index}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={handleDrop}
              onDragEnd={handleDragEnd}
            />
          ))}
        </div>
      )}

      <HandoffCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        agentId={agentId}
      />
    </div>
  );
}

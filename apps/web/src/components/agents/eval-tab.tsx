import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, MoreHorizontal, Pencil, Trash2, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { evalSetsQueryOptions, evalRunsQueryOptions } from "@/api/evaluation";
import type { EvalSet, EvalRun } from "@/api/evaluation";
import { EvalScoreBadge } from "@/components/agents/eval-score-badge";
import { EvalSetDialog } from "@/components/agents/eval-set-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { request } from "@/lib/api";

interface EvalTabProps {
  agentId: string;
}

function getLastScore(runs: EvalRun[], setId: number): number | null {
  const setRuns = runs
    .filter((r) => r.set_id === setId && r.status === "done")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return setRuns[0]?.score_avg ?? null;
}

function EvalSetCard({
  set,
  lastScore,
  onRun,
  isRunning,
  onEdit,
  onDelete,
}: {
  set: EvalSet;
  lastScore: number | null;
  onRun: () => void;
  isRunning: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const caseCount = set.cases?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="font-medium text-sm leading-none truncate">{set.name}</p>
            {set.description && (
              <p className="text-xs text-muted-foreground truncate">{set.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <EvalScoreBadge score={lastScore} />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-7"><MoreHorizontal className="size-4" /></Button>} />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="mr-2 size-3.5" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-3.5" />
                  Remover
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {caseCount} {caseCount === 1 ? "caso" : "casos"}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={onRun}
            disabled={isRunning || caseCount === 0}
          >
            <Play className={`mr-1.5 size-3.5 ${isRunning ? "animate-pulse" : ""}`} />
            {isRunning ? "Executando..." : "Run"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EvalTab({ agentId }: EvalTabProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<EvalSet | null>(null);
  const [runningSetId, setRunningSetId] = useState<number | null>(null);

  const { data: sets, isLoading: setsLoading } = useQuery(
    evalSetsQueryOptions(agentId),
  );
  const { data: runs } = useQuery(evalRunsQueryOptions(agentId));

  const runMutation = useMutation({
    mutationFn: (setId: number) =>
      request(`/agents/${agentId}/eval-sets/${setId}/runs`, { method: "POST" }),
    onMutate: (setId) => setRunningSetId(setId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eval-runs", agentId] });
      toast.success("Execucao iniciada");
      setRunningSetId(null);
    },
    onError: () => {
      toast.error("Erro ao iniciar execucao");
      setRunningSetId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (setId: number) =>
      request(`/agents/${agentId}/eval-sets/${setId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eval-sets", agentId] });
      toast.success("Set removido");
    },
    onError: () => toast.error("Erro ao remover set"),
  });

  function handleEdit(set: EvalSet) {
    setEditingSet(set);
    setDialogOpen(true);
  }

  function handleDialogClose(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditingSet(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Sets de Avaliacao</h3>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1 size-4" />
          Novo Set
        </Button>
      </div>

      {setsLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : !sets?.length ? (
        <EmptyState
          icon={<FlaskConical />}
          title="Nenhum set de avaliacao"
          description="Crie um set com casos para avaliar a qualidade deste agente."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sets.map((set) => (
            <EvalSetCard
              key={set.id}
              set={set}
              lastScore={getLastScore(runs ?? [], set.id)}
              onRun={() => runMutation.mutate(set.id)}
              isRunning={runningSetId === set.id}
              onEdit={() => handleEdit(set)}
              onDelete={() => deleteMutation.mutate(set.id)}
            />
          ))}
        </div>
      )}

      <EvalSetDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        agentId={agentId}
        editingSet={editingSet}
      />
    </div>
  );
}

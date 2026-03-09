import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Pencil, Trash2 } from "lucide-react";
import cronstrue from "cronstrue/i18n";
import {
  type CronJob,
  runCronJobManually,
  updateCronJob,
  deleteCronJob,
} from "@/api/cron";
import { CronRunHistory } from "@/components/cron/cron-run-history";
import { CronJobForm } from "@/components/cron/cron-job-form";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface CronJobDetailProps {
  job: CronJob;
  agentName?: string;
  onDeleted?: () => void;
}

function describeCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { locale: "pt_BR", use24HourTimeFormat: true });
  } catch {
    return expr;
  }
}

export function CronJobDetail({ job, agentName, onDeleted }: CronJobDetailProps) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["cron-runs", job.agentId, job.slug] });
  }, [queryClient, job.agentId, job.slug]);

  const runMutation = useMutation({
    mutationFn: () => runCronJobManually(job.agentId, job.slug),
    onSuccess: () => {
      invalidate();
      toast.success("Job executado com sucesso");
    },
    onError: () => toast.error("Erro ao executar job"),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      updateCronJob(job.agentId, job.slug, { enabled }),
    onSuccess: () => {
      invalidate();
      toast.success(
        job.def.enabled ? "Job desativado" : "Job ativado",
      );
    },
    onError: () => toast.error("Erro ao alterar status"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCronJob(job.agentId, job.slug),
    onSuccess: () => {
      invalidate();
      toast.success("Job excluido");
      onDeleted?.();
    },
    onError: () => toast.error("Erro ao excluir job"),
  });

  const scheduleDesc =
    job.def.schedule.kind === "cron" && job.def.schedule.expr
      ? describeCron(job.def.schedule.expr)
      : "—";

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{job.def.name || job.slug}</h3>
            <StatusBadge status={job.def.enabled ? "active" : "inactive"} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{agentName ?? job.agentId}</Badge>
            <span>{scheduleDesc}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            <Play className={`mr-1 size-4 ${runMutation.isPending ? "animate-pulse" : ""}`} />
            Executar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFormOpen(true)}
          >
            <Pencil className="mr-1 size-4" />
            Editar
          </Button>
          <div className="flex items-center gap-2">
            <Switch
              checked={job.def.enabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
            <span className="text-xs text-muted-foreground">
              {job.def.enabled ? "Ativo" : "Inativo"}
            </span>
          </div>
          <ConfirmDialog
            title="Excluir job"
            description={`Tem certeza que deseja excluir o job "${job.def.name || job.slug}"? Esta acao nao pode ser desfeita.`}
            onConfirm={() => deleteMutation.mutate()}
            destructive
          >
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1 size-4" />
              Excluir
            </Button>
          </ConfirmDialog>
        </div>
      </div>

      {/* Run History */}
      <div>
        <h4 className="mb-3 text-sm font-medium">Historico de execucoes</h4>
        <CronRunHistory agentId={job.agentId} jobSlug={job.slug} />
      </div>

      {/* Edit form dialog */}
      <CronJobForm
        open={formOpen}
        onOpenChange={setFormOpen}
        job={job}
      />
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Play, Plus } from "lucide-react";
import cronstrue from "cronstrue/i18n";
import { CronExpressionParser } from "cron-parser";
import {
  cronJobsQueryOptions,
  runCronJobManually,
  type CronJob,
} from "@/api/cron";
import { CronJobForm } from "@/components/cron/cron-job-form";
import { CronJobDetail } from "@/components/cron/cron-job-detail";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface AgentCronTabProps {
  agentId: string;
}

function describeCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { locale: "pt_BR", use24HourTimeFormat: true });
  } catch {
    return expr;
  }
}

function describeSchedule(job: CronJob): string {
  const { schedule } = job.def;
  if (schedule.kind === "cron" && schedule.expr) return describeCron(schedule.expr);
  if (schedule.kind === "every" && schedule.everyMs) {
    const secs = schedule.everyMs / 1000;
    if (secs < 60) return `A cada ${secs} segundos`;
    const mins = secs / 60;
    if (mins < 60) return `A cada ${mins} minutos`;
    return `A cada ${mins / 60} horas`;
  }
  if (schedule.kind === "at" && schedule.at) return `Em ${schedule.at}`;
  return "—";
}

function computeNextRun(job: CronJob): Date | null {
  if (job.state.nextRunAtMs) return new Date(job.state.nextRunAtMs);
  if (job.def.schedule.kind === "cron" && job.def.schedule.expr) {
    try {
      return CronExpressionParser.parse(job.def.schedule.expr).next().toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function formatRelativeTime(date: Date): string {
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const past = diff < 0;
  if (abs < 60_000) return past ? "agora" : "em breve";
  if (abs < 3_600_000) {
    const m = Math.floor(abs / 60_000);
    return past ? `${m}min atras` : `em ${m}min`;
  }
  if (abs < 86_400_000) {
    const h = Math.floor(abs / 3_600_000);
    return past ? `${h}h atras` : `em ${h}h`;
  }
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function AgentCronTab({ agentId }: AgentCronTabProps) {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<CronJob | null>(null);

  const { data: jobs, isLoading } = useQuery(
    cronJobsQueryOptions({ agentId, includeDisabled: true }),
  );

  const runMutation = useMutation({
    mutationFn: ({ agentId: aId, slug }: { agentId: string; slug: string }) =>
      runCronJobManually(aId, slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cron-jobs"] });
      toast.success("Job executado com sucesso");
    },
    onError: () => toast.error("Erro ao executar job"),
  });

  const handleRowClick = useCallback((job: CronJob) => {
    setSelectedJob(job);
  }, []);

  const agentNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (jobs ?? []).forEach((j) => { map[j.agentId] = j.agentId; });
    return map;
  }, [jobs]);

  if (selectedJob) {
    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedJob(null)}
        >
          Voltar para lista
        </Button>
        <CronJobDetail
          job={selectedJob}
          agentName={agentNameMap[selectedJob.agentId]}
          onDeleted={() => setSelectedJob(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Jobs agendados</h3>
        <Button
          size="sm"
          onClick={() => setFormOpen(true)}
        >
          <Plus className="mr-1 size-4" />
          Novo Job
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      ) : !jobs?.length ? (
        <EmptyState
          icon={<Calendar />}
          title="Nenhum agendamento"
          description="Crie uma tarefa agendada para este agente."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Agenda</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Proxima</TableHead>
                <TableHead>Ultima</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => {
                const nextRun = computeNextRun(job);
                const lastRun = job.state.lastRunAtMs ? new Date(job.state.lastRunAtMs) : null;
                const isRunning =
                  runMutation.isPending &&
                  runMutation.variables?.agentId === job.agentId &&
                  runMutation.variables?.slug === job.slug;

                return (
                  <TableRow
                    key={`${job.agentId}/${job.slug}`}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(job)}
                  >
                    <TableCell className="font-medium">{job.def.name || job.slug}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {describeSchedule(job)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.def.enabled ? "active" : "inactive"} />
                    </TableCell>
                    <TableCell className="text-sm">
                      {job.def.enabled && nextRun ? formatRelativeTime(nextRun) : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {lastRun ? (
                        <div className="flex items-center gap-2">
                          <span>{formatRelativeTime(lastRun)}</span>
                          {job.state.lastStatus && (
                            <StatusBadge
                              status={
                                job.state.lastStatus === "ok" ? "active" :
                                job.state.lastStatus === "error" ? "error" : "warning"
                              }
                              label={
                                job.state.lastStatus === "ok" ? "OK" :
                                job.state.lastStatus === "error" ? "Erro" : "Skip"
                              }
                            />
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          runMutation.mutate({ agentId: job.agentId, slug: job.slug });
                        }}
                        disabled={isRunning}
                      >
                        <Play className={`size-4 ${isRunning ? "animate-pulse" : ""}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CronJobForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
        }}
        agentId={agentId}
      />
    </div>
  );
}

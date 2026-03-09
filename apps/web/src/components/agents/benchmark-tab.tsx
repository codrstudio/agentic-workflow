import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import {
  benchmarkRunsQueryOptions,
  benchmarkTrendQueryOptions,
  type BenchmarkRun,
  type BenchmarkTrendPoint,
} from "@/api/benchmarks";
import { evalSetsQueryOptions } from "@/api/evaluation";
import { request } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface BenchmarkTabProps {
  agentId: string;
}

// ── Delta badge ────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <Badge variant="outline">—</Badge>;

  const pct = (delta * 100).toFixed(1);

  if (delta > 0.005) {
    return (
      <Badge className="bg-green-500/15 text-green-700 border-green-500/30 hover:bg-green-500/20 gap-1">
        <TrendingUp className="size-3" />+{pct}%
      </Badge>
    );
  }
  if (delta < -0.005) {
    return (
      <Badge className="bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/20 gap-1">
        <TrendingDown className="size-3" />
        {pct}%
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Minus className="size-3" />
      {pct}%
    </Badge>
  );
}

// ── Status badge ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: BenchmarkRun["status"] }) {
  const map: Record<
    BenchmarkRun["status"],
    { label: string; className: string }
  > = {
    pending: {
      label: "Aguardando",
      className:
        "bg-slate-500/15 text-slate-600 border-slate-500/30",
    },
    running: {
      label: "Executando",
      className:
        "bg-blue-500/15 text-blue-700 border-blue-500/30 animate-pulse",
    },
    done: {
      label: "Concluido",
      className: "bg-green-500/15 text-green-700 border-green-500/30",
    },
    failed: {
      label: "Falhou",
      className: "bg-red-500/15 text-red-700 border-red-500/30",
    },
  };

  const config = map[status];
  return <Badge className={cn(config.className)}>{config.label}</Badge>;
}

// ── Score cell ─────────────────────────────────────────────────────────────

function ScoreCell({ score }: { score: number | null }) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  const pct = Math.round(score * 100);
  const color =
    pct >= 80
      ? "text-green-700 dark:text-green-400"
      : pct >= 50
        ? "text-yellow-700 dark:text-yellow-400"
        : "text-red-700 dark:text-red-400";
  return <span className={cn("font-medium tabular-nums", color)}>{pct}%</span>;
}

// ── Timeline ───────────────────────────────────────────────────────────────

function BenchmarkTimeline({ trend }: { trend: BenchmarkTrendPoint[] }) {
  if (trend.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nenhuma run concluida ainda.
      </p>
    );
  }

  return (
    <div className="flex items-end gap-1.5 h-10 overflow-x-auto pb-1">
      {trend.map((point) => {
        const dotColor = point.regression
          ? "bg-red-500"
          : (point.delta ?? 0) > 0.005
            ? "bg-green-500"
            : "bg-slate-400";

        return (
          <div
            key={point.benchmarkId}
            title={`v${point.version} · ${point.date} · score: ${point.score != null ? Math.round(point.score * 100) + "%" : "—"}`}
            className={cn(
              "size-3 rounded-full shrink-0 cursor-pointer hover:opacity-80 transition-opacity",
              dotColor,
            )}
          />
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function BenchmarkTab({ agentId }: BenchmarkTabProps) {
  const queryClient = useQueryClient();
  const [selectedEvalSetId, setSelectedEvalSetId] = useState<string | null>(null);

  const { data: runsData, isLoading: runsLoading } = useQuery(
    benchmarkRunsQueryOptions(agentId),
  );
  const { data: trendData } = useQuery(benchmarkTrendQueryOptions(agentId));
  const { data: evalSets } = useQuery(evalSetsQueryOptions(agentId));

  const triggerMutation = useMutation({
    mutationFn: (evalSetId?: string) =>
      request<{ benchmarkId: string; status: string; message: string }>(
        `/agents/${agentId}/benchmarks`,
        {
          method: "POST",
          body: JSON.stringify(evalSetId ? { evalSetId } : {}),
        },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["benchmark-runs", agentId],
      });
      queryClient.invalidateQueries({
        queryKey: ["benchmark-latest", agentId],
      });
      toast.success(data.message ?? "Benchmark iniciado");
    },
    onError: () => toast.error("Erro ao iniciar benchmark"),
  });

  const runs = runsData?.items ?? [];
  const trend = trendData?.trend ?? [];
  const latestRun = runs[0];
  const hasRegression = latestRun?.regression === true;

  function handleTrigger() {
    triggerMutation.mutate(selectedEvalSetId ?? undefined);
  }

  return (
    <div className="space-y-5">
      {/* Regression alert */}
      {hasRegression && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-700/50 dark:bg-red-950/30">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">
              Regressao detectada na ultima run
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              O score caiu {latestRun.delta != null ? Math.abs(latestRun.delta * 100).toFixed(1) + "%" : ""} em relacao a versao anterior.{" "}
              <Link
                to="/agents/$id/benchmarks/$runId"
                params={{ id: agentId, runId: latestRun.id }}
                className="underline hover:opacity-80"
              >
                Ver detalhes
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Header row: title + trigger */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Benchmark Runs</h3>
          {runsData && (
            <p className="text-xs text-muted-foreground">
              {runsData.total} runs no total
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {evalSets && evalSets.length > 1 && (
            <Select
              value={selectedEvalSetId ?? ""}
              onValueChange={(v) => setSelectedEvalSetId(v || null)}
            >
              <SelectTrigger className="h-8 w-44 text-xs">
                <SelectValue placeholder="Golden set (ultimo)" />
              </SelectTrigger>
              <SelectContent>
                {evalSets.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button
            size="sm"
            onClick={handleTrigger}
            disabled={triggerMutation.isPending}
          >
            <Play
              className={cn(
                "mr-1.5 size-3.5",
                triggerMutation.isPending && "animate-pulse",
              )}
            />
            {triggerMutation.isPending ? "Iniciando..." : "Rodar benchmark agora"}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {trend.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Historico de scores ({trend.length} runs)
          </p>
          <BenchmarkTimeline trend={trend} />
        </div>
      )}

      {/* Table */}
      {runsLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : runs.length === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title="Nenhum benchmark executado"
          description="Clique em 'Rodar benchmark agora' para comparar versoes do agente automaticamente."
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versao</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Score antes</TableHead>
                <TableHead className="text-right">Score depois</TableHead>
                <TableHead className="text-right">Delta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-mono text-xs">
                    v{run.versionTo}
                    {run.versionFrom && (
                      <span className="text-muted-foreground">
                        {" "}← v{run.versionFrom}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(run.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <ScoreCell score={run.scoreBefore} />
                  </TableCell>
                  <TableCell className="text-right">
                    <ScoreCell score={run.scoreAfter} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeltaBadge delta={run.delta} />
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to="/agents/$id/benchmarks/$runId"
                      params={{ id: agentId, runId: run.id }}
                      className="text-xs text-primary underline hover:opacity-80"
                    >
                      Detalhes
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

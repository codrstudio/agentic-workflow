import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Activity } from "lucide-react";
import { cronRunHistoryQueryOptions, type CronRunEntry } from "@/api/cron";
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
import { TraceDrawer } from "@/components/traces/trace-drawer";

interface CronRunHistoryProps {
  agentId: string;
  jobSlug: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function statusToBadge(status: CronRunEntry["status"]) {
  switch (status) {
    case "ok":
      return { status: "active" as const, label: "OK" };
    case "error":
      return { status: "error" as const, label: "Erro" };
    case "timeout":
      return { status: "warning" as const, label: "Timeout" };
    case "skipped":
      return { status: "warning" as const, label: "Skip" };
  }
}

export function CronRunHistory({ agentId, jobSlug }: CronRunHistoryProps) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery(
    cronRunHistoryQueryOptions(agentId, jobSlug, page),
  );
  const [traceState, setTraceState] = useState<{ open: boolean; id: string }>({
    open: false,
    id: "",
  });

  const runs = data?.runs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhuma execucao registrada.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Data/Hora</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duracao</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Custo</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {runs.map((run, i) => (
              <RunRow
                key={`${run.ts}-${i}`}
                run={run}
                onTrace={(id) => setTraceState({ open: true, id })}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Pagina {page} de {totalPages} ({total} execucoes)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Proxima
            </Button>
          </div>
        </div>
      )}

      <TraceDrawer
        type="cron"
        id={traceState.id}
        open={traceState.open}
        onClose={() => setTraceState((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

function RunRow({
  run,
  onTrace,
}: {
  run: CronRunEntry;
  onTrace: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const badge = statusToBadge(run.status);
  const tokens = run.tokens;
  const totalTokens =
    tokens ? (tokens.input ?? 0) + (tokens.output ?? 0) : null;

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <TableCell className="w-8 px-2">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="text-sm">{formatTimestamp(run.ts)}</TableCell>
        <TableCell>
          <StatusBadge status={badge.status} label={badge.label} />
        </TableCell>
        <TableCell className="text-sm">{formatDuration(run.duration_ms)}</TableCell>
        <TableCell className="text-sm">
          {totalTokens !== null ? totalTokens.toLocaleString("pt-BR") : "—"}
        </TableCell>
        <TableCell className="text-sm">
          {run.cost_usd !== undefined && run.cost_usd !== null
            ? `$${run.cost_usd.toFixed(4)}`
            : "—"}
        </TableCell>
        <TableCell className="w-10 px-2">
          {run.id != null && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground"
              title="Ver trace"
              onClick={(e) => {
                e.stopPropagation();
                onTrace(String(run.id));
              }}
            >
              <Activity className="size-3.5" />
            </Button>
          )}
        </TableCell>
      </TableRow>
      {expanded && (run.preview || run.error) && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/50 px-4 py-3">
            <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
              {run.error ?? run.preview}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

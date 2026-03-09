import { Activity, AlertTriangle, DollarSign, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentStats } from "@/api/agents";

interface AgentMetricsProps {
  stats: AgentStats;
}

function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatCost(usd: number): string {
  return `$ ${usd.toFixed(4)}`;
}

function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  return `${seconds.toFixed(1)}s`;
}

export function AgentMetrics({ stats }: AgentMetricsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de execucoes</CardTitle>
          <Activity className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(stats.totalRuns)}</div>
          <div className="mt-1 flex gap-2 text-xs text-muted-foreground">
            <span className="text-green-600 dark:text-green-400">
              {formatNumber(stats.byStatus.ok)} ok
            </span>
            <span className="text-yellow-600 dark:text-yellow-400">
              {formatNumber(stats.byStatus.skipped)} skip
            </span>
            <span className="text-red-600 dark:text-red-400">
              {formatNumber(stats.byStatus.error)} erro
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">OK / Skip / Erro</CardTitle>
          <AlertTriangle className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatNumber(stats.byStatus.ok)}
            </span>
            <span className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
              {formatNumber(stats.byStatus.skipped)}
            </span>
            <span className="text-lg font-semibold text-red-600 dark:text-red-400">
              {formatNumber(stats.byStatus.error)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Por status</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custo total</CardTitle>
          <DollarSign className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCost(stats.totalCostUsd)}</div>
          <p className="mt-1 text-xs text-muted-foreground">USD</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Duracao media</CardTitle>
          <Timer className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatDuration(stats.avgDurationMs)}</div>
          <p className="mt-1 text-xs text-muted-foreground">por execucao</p>
        </CardContent>
      </Card>
    </div>
  );
}

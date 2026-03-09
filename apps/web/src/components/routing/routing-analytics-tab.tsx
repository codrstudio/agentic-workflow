import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { TrendingDown } from "lucide-react";
import { agentRoutingStatsQueryOptions } from "@/api/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#f97316",
];

interface RoutingAnalyticsTabProps {
  agentId: string;
}

type PeriodDays = "7" | "30" | "90";

function SavingsGauge({
  savedPct,
  savedUsd,
  withoutUsd,
  withUsd,
}: {
  savedPct: number;
  savedUsd: number;
  withoutUsd: number;
  withUsd: number;
}) {
  const pct = Math.round(savedPct * 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(savedPct, 1) * circ).toFixed(1);

  const color =
    pct >= 40
      ? "text-green-600"
      : pct >= 20
        ? "text-yellow-600"
        : "text-muted-foreground";
  const stroke =
    pct >= 40
      ? "stroke-green-500"
      : pct >= 20
        ? "stroke-yellow-500"
        : "stroke-muted";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <TrendingDown className="size-4" />
          Economia Estimada
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle
              cx={50}
              cy={50}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={10}
              className="text-muted"
            />
            <circle
              cx={50}
              cy={50}
              r={r}
              fill="none"
              strokeWidth={10}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              className={cn(stroke)}
            />
          </svg>
          <span className={cn("absolute text-xl font-bold", color)}>{pct}%</span>
        </div>
        <div className="flex gap-6 text-sm w-full">
          <div className="flex flex-col items-center flex-1">
            <span className="text-base font-semibold text-green-600">
              ${savedUsd.toFixed(4)}
            </span>
            <span className="text-xs text-muted-foreground">Economizado</span>
          </div>
          <div className="flex flex-col items-center flex-1">
            <span className="text-base font-semibold">${withUsd.toFixed(4)}</span>
            <span className="text-xs text-muted-foreground">Com routing</span>
          </div>
          <div className="flex flex-col items-center flex-1">
            <span className="text-base font-semibold text-muted-foreground">
              ${withoutUsd.toFixed(4)}
            </span>
            <span className="text-xs text-muted-foreground">Sem routing</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Estimativa com ~1.000 tokens/execucao (tabela de precos estatica)
        </p>
      </CardContent>
    </Card>
  );
}

export function RoutingAnalyticsTab({ agentId }: RoutingAnalyticsTabProps) {
  const [period, setPeriod] = useState<PeriodDays>("30");

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - Number(period) * 86400_000)
    .toISOString()
    .slice(0, 10);

  const { data: stats, isLoading } = useQuery(
    agentRoutingStatsQueryOptions(agentId, { from, to }),
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Pie chart data: model distribution
  const pieData = Object.entries(stats.modelDistribution).map(
    ([model, { count, pct }]) => ({
      name: model.split("/").pop() ?? model,
      fullName: model,
      value: count,
      pct: Math.round(pct * 100),
    }),
  );

  // Bar chart data: rule hits
  const barData = Object.entries(stats.ruleHits)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([rule, count]) => ({ rule, count }));

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Model Routing Analytics</h3>
          <p className="text-xs text-muted-foreground">
            {stats.totalExecutions} execucoes no periodo
            {!stats.globalRoutingEnabled && (
              <span className="ml-2 text-yellow-600">(routing desabilitado globalmente)</span>
            )}
          </p>
        </div>
        <Select
          value={period}
          onValueChange={(v) => setPeriod(v as PeriodDays)}
        >
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {stats.totalExecutions === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Nenhuma execucao com routing registrada no periodo.
        </div>
      ) : (
        <>
          {/* Savings gauge */}
          <div className="max-w-sm">
            <SavingsGauge
              savedPct={stats.estimatedSavings.saved_pct}
              savedUsd={stats.estimatedSavings.saved_usd}
              withoutUsd={stats.estimatedSavings.without_routing_usd}
              withUsd={stats.estimatedSavings.with_routing_usd}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pie chart: model distribution */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Distribuicao por Modelo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pieData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Sem dados.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, _name, props) => [
                          `${value} (${props.payload?.pct ?? 0}%)`,
                          props.payload?.fullName ?? "",
                        ]}
                      />
                      <Legend
                        iconSize={10}
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value) => value}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Bar chart: rule hits */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Regras Mais Acionadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {barData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Sem dados de regras.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart
                      data={barData}
                      layout="vertical"
                      margin={{ left: 0, right: 16, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="rule"
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

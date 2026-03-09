import { Zap, Layers, Target } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import { formatTokens } from "@/components/metrics-table";
import {
  useContextMetrics,
  type SourceEffectiveness,
} from "@/hooks/use-context-metrics";
import { cn } from "@/lib/utils";

const CATEGORY_CHART_COLORS: Record<string, string> = {
  frontend: "#3b82f6",
  backend: "#22c55e",
  business: "#a855f7",
  reference: "#f97316",
  config: "#64748b",
  general: "#6b7280",
};

interface ContextMetricsTabProps {
  projectId: string;
}

export function ContextMetricsTab({ projectId }: ContextMetricsTabProps) {
  const { data, isLoading } = useContextMetrics(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <KpiCardGrid>
          {[1, 2, 3].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
        <div className="h-48 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (!data || data.total_sessions === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
        <Target className="h-10 w-10 opacity-40" />
        <p className="text-sm">Sem dados de contexto ainda.</p>
        <p className="text-xs">
          Metricas aparecerao apos sessoes de chat registrarem usage logs.
        </p>
      </div>
    );
  }

  // Compute overall effectiveness
  const totalIncluded = data.source_effectiveness.reduce(
    (sum, s) => sum + s.included,
    0
  );
  const totalReferenced = data.source_effectiveness.reduce(
    (sum, s) => sum + s.referenced,
    0
  );
  const overallEffectiveness =
    totalIncluded > 0
      ? Math.round((totalReferenced / totalIncluded) * 100)
      : 0;

  // Prepare bar chart data
  const allCategories = new Set<string>();
  for (const session of data.session_breakdown) {
    for (const cat of Object.keys(session.by_category)) {
      allCategories.add(cat);
    }
  }
  const categories = Array.from(allCategories).sort();

  const chartData = data.session_breakdown.map((session, idx) => {
    const row: Record<string, string | number> = {
      name: `S${idx + 1}`,
    };
    for (const cat of categories) {
      row[cat] = session.by_category[cat] ?? 0;
    }
    return row;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      <KpiCardGrid>
        <KpiCard
          icon={Zap}
          iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          label="Tokens Medios / Sessao"
          value={formatTokens(data.avg_context_tokens)}
          subtitle={`${data.total_sessions} sessoes registradas`}
        />
        <KpiCard
          icon={Layers}
          iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
          label="Sources Medios / Sessao"
          value={data.avg_sources_per_session.toFixed(1)}
          subtitle={`${data.source_effectiveness.length} sources distintos`}
        />
        <KpiCard
          icon={Target}
          iconClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          label="Eficacia de Contexto"
          value={`${overallEffectiveness}%`}
          subtitle="referenciados / incluidos"
        />
      </KpiCardGrid>

      {/* Bar Chart: Tokens by Session */}
      {chartData.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-lg font-semibold text-foreground">
            Tokens por Sessao
          </h3>
          <div className="rounded-lg border bg-card p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis
                  fontSize={12}
                  tickFormatter={(v: number) => formatTokens(v)}
                />
                <Tooltip
                  formatter={(value, name) => [
                    formatTokens(Number(value)),
                    String(name).charAt(0).toUpperCase() + String(name).slice(1),
                  ]}
                />
                <Legend />
                {categories.map((cat) => (
                  <Bar
                    key={cat}
                    dataKey={cat}
                    stackId="tokens"
                    fill={CATEGORY_CHART_COLORS[cat] ?? "#9ca3af"}
                    name={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Source Effectiveness Table */}
      <div className="flex flex-col gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          Eficacia por Source
        </h3>
        <EffectivenessTable sources={data.source_effectiveness} />
      </div>
    </div>
  );
}

function EffectivenessTable({
  sources,
}: {
  sources: SourceEffectiveness[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Source
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              Categoria
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
              Incluido
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
              Referenciado
            </th>
            <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
              Eficacia
            </th>
          </tr>
        </thead>
        <tbody>
          {sources.map((source) => {
            const pct = Math.round(source.ratio * 100);
            return (
              <tr
                key={source.source_id}
                className={cn(
                  "border-b last:border-b-0 transition-colors",
                  pct < 20 && "bg-red-500/5",
                  pct > 80 && "bg-green-500/5"
                )}
              >
                <td className="px-3 py-2 font-medium">{source.name}</td>
                <td className="px-3 py-2 text-muted-foreground capitalize">
                  {source.category}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {source.included}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {source.referenced}
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right tabular-nums font-semibold",
                    pct < 20 && "text-red-600 dark:text-red-400",
                    pct > 80 && "text-green-600 dark:text-green-400"
                  )}
                >
                  {pct}%
                </td>
              </tr>
            );
          })}
          {sources.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                Nenhum source com dados de eficacia
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

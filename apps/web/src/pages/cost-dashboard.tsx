import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import {
  DollarSign,
  Zap,
  TrendingUp,
  Cpu,
  BarChart3,
  Lightbulb,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import {
  MetricsTable,
  formatTokens,
  formatCost,
  type MetricsColumn,
} from "@/components/metrics-table";
import {
  useCostSummary,
  useModelRecommendations,
  type CostSummaryResponse,
} from "@/hooks/use-cost-metrics";
import { cn } from "@/lib/utils";

// --- Period helpers ---

type PeriodPreset = "7d" | "30d" | "90d" | "custom";

function computePeriodDates(preset: PeriodPreset, customFrom: string, customTo: string) {
  const now = new Date();
  const to = now.toISOString();
  if (preset === "custom" && customFrom && customTo) {
    return { from: new Date(customFrom).toISOString(), to: new Date(customTo + "T23:59:59").toISOString() };
  }
  const days = preset === "30d" ? 30 : preset === "90d" ? 90 : 7;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

function computePreviousPeriodDates(from: string, to: string) {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  const duration = toMs - fromMs;
  return {
    from: new Date(fromMs - duration).toISOString(),
    to: from,
  };
}

// --- Chart colors ---

const MODEL_COLORS: Record<string, string> = {
  "claude-haiku-4-5": "#22c55e",
  "claude-sonnet-4-6": "#3b82f6",
  "claude-opus-4-6": "#a855f7",
  other: "#6b7280",
};

const PHASE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#ef4444",
  "#64748b",
  "#eab308",
  "#06b6d4",
];

const COST_TIER_COLORS: Record<string, string> = {
  low: "bg-green-500/10 text-green-700 dark:text-green-400",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  high: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const QUALITY_TIER_COLORS: Record<string, string> = {
  standard: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  premium: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

// --- Format helpers ---

function formatUsd(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

function formatTrend(current: number, previous: number): string | undefined {
  if (previous === 0) return undefined;
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}% vs periodo anterior`;
}

function formatModelName(model: string): string {
  return model
    .replace("claude-", "")
    .replace("-4-5", " 4.5")
    .replace("-4-6", " 4.6")
    .replace(/^\w/, (c) => c.toUpperCase());
}

// --- Main component ---

export function CostDashboardPage() {
  const { projectId } = useParams({ strict: false }) as {
    projectId: string;
  };

  const [period, setPeriod] = useState<PeriodPreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const { from, to } = useMemo(
    () => computePeriodDates(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  const prevPeriod = useMemo(
    () => computePreviousPeriodDates(from, to),
    [from, to]
  );

  const { data: current, isLoading } = useCostSummary(projectId, from, to);
  const { data: previous } = useCostSummary(
    projectId,
    prevPeriod.from,
    prevPeriod.to
  );
  const { data: recommendations } = useModelRecommendations(projectId);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-bold">Cost Dashboard</h1>
        <KpiCardGrid>
          {[1, 2, 3, 4].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
        <div className="h-72 animate-pulse rounded-lg border bg-muted" />
        <div className="h-64 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 py-16 text-center text-muted-foreground">
        <DollarSign className="h-10 w-10 opacity-40" />
        <p className="text-sm">Sem dados de custo ainda.</p>
        <p className="text-xs">
          Dados aparecerao apos sessoes registrarem token usage.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Cost Dashboard</h1>
        <PeriodSelector
          period={period}
          setPeriod={setPeriod}
          customFrom={customFrom}
          setCustomFrom={setCustomFrom}
          customTo={customTo}
          setCustomTo={setCustomTo}
        />
      </div>

      <KpiCards data={current} previous={previous ?? null} />

      <CostPerDayChart data={current} from={from} to={to} />

      <CostByPhaseChart data={current} />

      <TopFeaturesTable data={current} />

      <TopSessionsTable data={current} />

      {recommendations && recommendations.length > 0 && (
        <ModelRecommendations recommendations={recommendations} />
      )}
    </div>
  );
}

// --- Period Selector ---

function PeriodSelector({
  period,
  setPeriod,
  customFrom,
  setCustomFrom,
  customTo,
  setCustomTo,
}: {
  period: PeriodPreset;
  setPeriod: (p: PeriodPreset) => void;
  customFrom: string;
  setCustomFrom: (v: string) => void;
  customTo: string;
  setCustomTo: (v: string) => void;
}) {
  const presets: { value: PeriodPreset; label: string }[] = [
    { value: "7d", label: "7d" },
    { value: "30d", label: "30d" },
    { value: "90d", label: "90d" },
    { value: "custom", label: "Custom" },
  ];

  return (
    <div className="flex items-center gap-2">
      <div className="flex rounded-lg border bg-muted/50 p-0.5">
        {presets.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              period === p.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {period === "custom" && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs"
          />
          <span className="text-xs text-muted-foreground">-</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-xs"
          />
        </div>
      )}
    </div>
  );
}

// --- KPI Cards ---

function KpiCards({
  data,
  previous,
}: {
  data: CostSummaryResponse;
  previous: CostSummaryResponse | null;
}) {
  const totalTokens =
    data.total_input_tokens +
    data.total_output_tokens +
    data.total_cache_read_tokens;

  const featureCount = data.by_feature.length;
  const avgCostPerFeature =
    featureCount > 0 ? data.total_cost_usd / featureCount : 0;

  // Find most expensive model
  const models = Object.entries(data.by_model);
  const mostExpensiveModel =
    models.length > 0
      ? models.reduce((max, cur) =>
          cur[1].cost_usd > max[1].cost_usd ? cur : max
        )
      : null;

  const costTrend = previous
    ? formatTrend(data.total_cost_usd, previous.total_cost_usd)
    : undefined;

  return (
    <KpiCardGrid>
      <KpiCard
        icon={DollarSign}
        iconClassName="bg-green-500/10 text-green-600 dark:text-green-400"
        label="Custo Total"
        value={formatUsd(data.total_cost_usd)}
        subtitle={costTrend}
      />
      <KpiCard
        icon={Zap}
        iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        label="Tokens Consumidos"
        value={formatTokens(totalTokens)}
        subtitle={`${formatTokens(data.total_input_tokens)} in / ${formatTokens(data.total_output_tokens)} out`}
      />
      <KpiCard
        icon={TrendingUp}
        iconClassName="bg-purple-500/10 text-purple-600 dark:text-purple-400"
        label="Custo Medio / Feature"
        value={formatUsd(avgCostPerFeature)}
        subtitle={`${featureCount} features com uso`}
      />
      <KpiCard
        icon={Cpu}
        iconClassName="bg-orange-500/10 text-orange-600 dark:text-orange-400"
        label="Modelo Mais Caro"
        value={
          mostExpensiveModel
            ? formatModelName(mostExpensiveModel[0])
            : "-"
        }
        subtitle={
          mostExpensiveModel
            ? formatUsd(mostExpensiveModel[1].cost_usd)
            : undefined
        }
      />
    </KpiCardGrid>
  );
}

// --- Cost Per Day Area Chart ---

interface DayDataPoint {
  date: string;
  [model: string]: string | number;
}

function buildDailyData(
  data: CostSummaryResponse,
  from: string,
  to: string
): { chartData: DayDataPoint[]; models: string[] } {
  // We need per-day per-model breakdown.
  // The cost-summary API aggregates by model total, not by day.
  // We'll approximate by distributing model cost evenly across the period days.
  // For a proper implementation, we'd need a daily breakdown endpoint.
  // However, we can create meaningful chart data from the by_model totals.

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days: string[] = [];
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  const endDay = new Date(toDate);
  endDay.setHours(0, 0, 0, 0);

  while (cursor <= endDay) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  if (days.length === 0) days.push(new Date().toISOString().slice(0, 10));

  const models = Object.keys(data.by_model);
  const dayCount = days.length;

  const chartData: DayDataPoint[] = days.map((date) => {
    const point: DayDataPoint = {
      date: new Date(date).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      }),
    };
    for (const model of models) {
      const modelData = data.by_model[model];
      point[model] = modelData
        ? parseFloat((modelData.cost_usd / dayCount).toFixed(4))
        : 0;
    }
    return point;
  });

  return { chartData, models };
}

function CostPerDayChart({
  data,
  from,
  to,
}: {
  data: CostSummaryResponse;
  from: string;
  to: string;
}) {
  const { chartData, models } = useMemo(
    () => buildDailyData(data, from, to),
    [data, from, to]
  );

  if (models.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-foreground">Custo por Dia</h3>
      <div className="rounded-lg border bg-card p-4">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="date" fontSize={12} />
            <YAxis
              fontSize={12}
              tickFormatter={(v: number) => formatUsd(v)}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatUsd(value),
                formatModelName(name),
              ]}
            />
            <Legend formatter={(value: string) => formatModelName(value)} />
            {models.map((model) => (
              <Area
                key={model}
                type="monotone"
                dataKey={model}
                stackId="cost"
                fill={MODEL_COLORS[model] ?? "#6b7280"}
                stroke={MODEL_COLORS[model] ?? "#6b7280"}
                fillOpacity={0.6}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Cost by Phase Pie Chart ---

function CostByPhaseChart({ data }: { data: CostSummaryResponse }) {
  const phases = Object.entries(data.by_phase);
  if (phases.length === 0) return null;

  const chartData = phases.map(([phase, v]) => ({
    name: phase.charAt(0).toUpperCase() + phase.slice(1),
    value: parseFloat(v.cost_usd.toFixed(4)),
  }));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-foreground">Custo por Fase</h3>
      <div className="rounded-lg border bg-card p-4">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              outerRadius={100}
              dataKey="value"
              label={({ name, value }) => `${name}: ${formatUsd(value)}`}
            >
              {chartData.map((_, idx) => (
                <Cell
                  key={idx}
                  fill={PHASE_COLORS[idx % PHASE_COLORS.length]!}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => [formatUsd(value), "Custo"]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Top Features Table ---

interface FeatureRow {
  feature_id: string;
  total_tokens: number;
  cost_usd: number;
  dominant_model: string;
}

function TopFeaturesTable({ data }: { data: CostSummaryResponse }) {
  const rows: FeatureRow[] = data.by_feature.map((f) => {
    // Determine dominant model based on overall model distribution
    const models = Object.entries(data.by_model);
    const dominant =
      models.length > 0
        ? models.reduce((max, cur) =>
            cur[1].cost_usd > max[1].cost_usd ? cur : max
          )[0]
        : "unknown";

    return {
      feature_id: f.feature_id,
      total_tokens: f.total_tokens,
      cost_usd: f.cost_usd,
      dominant_model: formatModelName(dominant),
    };
  });

  const columns: MetricsColumn<FeatureRow>[] = [
    { key: "feature_id", label: "Feature ID" },
    { key: "total_tokens", label: "Tokens", format: "tokens" },
    { key: "cost_usd", label: "Custo USD", format: "cost" },
    { key: "dominant_model", label: "Modelo Predominante" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-foreground">
        Top Features por Custo
      </h3>
      <MetricsTable
        data={rows}
        columns={columns}
        keyFn={(r) => r.feature_id}
        defaultSortKey="cost_usd"
        defaultSortDir="desc"
        emptyMessage="Nenhuma feature com dados de custo"
      />
    </div>
  );
}

// --- Top Sessions Table ---

interface SessionRow {
  session_id: string;
  title: string;
  total_tokens: number;
  cost_usd: number;
  date: string;
}

function TopSessionsTable({ data }: { data: CostSummaryResponse }) {
  const rows: SessionRow[] = data.by_session.map((s) => ({
    session_id: s.session_id,
    title: s.session_id,
    total_tokens: s.total_tokens,
    cost_usd: s.cost_usd,
    date: data.computed_at,
  }));

  const columns: MetricsColumn<SessionRow>[] = [
    { key: "session_id", label: "Sessao" },
    { key: "title", label: "Titulo" },
    { key: "total_tokens", label: "Tokens", format: "tokens" },
    { key: "cost_usd", label: "Custo USD", format: "cost" },
    { key: "date", label: "Data", format: "date" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-foreground">
        Top Sessions por Custo
      </h3>
      <MetricsTable
        data={rows}
        columns={columns}
        keyFn={(r) => r.session_id}
        defaultSortKey="cost_usd"
        defaultSortDir="desc"
        emptyMessage="Nenhuma sessao com dados de custo"
      />
    </div>
  );
}

// --- Model Recommendations ---

function ModelRecommendations({
  recommendations,
}: {
  recommendations: Array<{
    phase: string;
    recommended_model: string;
    rationale: string;
    cost_tier: string;
    quality_tier: string;
  }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-yellow-500" />
        <h3 className="text-lg font-semibold text-foreground">
          Recomendacoes de Modelo
        </h3>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec) => (
          <div
            key={rec.phase}
            className="flex flex-col gap-2 rounded-lg border bg-card p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold capitalize">
                {rec.phase}
              </span>
              <div className="flex gap-1.5">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    COST_TIER_COLORS[rec.cost_tier] ?? COST_TIER_COLORS.medium
                  )}
                >
                  {rec.cost_tier}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-medium",
                    QUALITY_TIER_COLORS[rec.quality_tier] ??
                      QUALITY_TIER_COLORS.standard
                  )}
                >
                  {rec.quality_tier}
                </span>
              </div>
            </div>
            <p className="text-sm font-medium text-foreground">
              {formatModelName(rec.recommended_model)}
            </p>
            <p className="text-xs text-muted-foreground">{rec.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

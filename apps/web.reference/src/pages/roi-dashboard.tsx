import React, { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CheckCircle2,
  RefreshCw,
  Clock,
  BarChart2,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useROIMetrics,
  useROISnapshots,
  useROIBySprint,
  type AIROIMetrics,
  type ROISnapshot,
  type SprintROI,
  type ByModelEntry,
} from "@/hooks/use-roi";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const PERIOD_OPTIONS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: 0 },
] as const;

const MODEL_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#38bdf8"];

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function fmt$(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function fmtRatio(r: number): string {
  return `${r.toFixed(2)}x`;
}

function fmtHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}min`;
  return `${h.toFixed(1)}h`;
}

function periodStartISO(days: number): string | undefined {
  if (days === 0) return undefined;
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ----------------------------------------------------------------
// Hero KPI
// ----------------------------------------------------------------

function HeroKPI({ metrics }: { metrics: AIROIMetrics }) {
  const ratio = metrics.core_roi.roi_ratio;
  const changePct = metrics.cost_trend.change_pct;
  const positive = changePct <= 0; // cost decreased = good

  return (
    <div
      className="rounded-xl border bg-gradient-to-br from-indigo-50 to-violet-50 p-6 dark:from-indigo-950/30 dark:to-violet-950/30"
      data-testid="hero-kpi"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">ROI Ratio</p>
          <p className="mt-1 text-5xl font-bold tabular-nums text-indigo-700 dark:text-indigo-300">
            {fmtRatio(ratio)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            economia estimada / custo AI
          </p>
        </div>

        {/* Trend indicator */}
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold",
            positive
              ? "bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
          )}
          data-testid="trend-indicator"
        >
          {positive ? (
            <TrendingDown className="h-4 w-4" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
          <span>
            {positive ? "" : "+"}
            {changePct.toFixed(1)}% custo semana
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 text-center">
        <div className="rounded-lg bg-white/60 p-3 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">Custo Total</p>
          <p className="text-lg font-bold">{fmt$(metrics.core_roi.total_cost_usd)}</p>
        </div>
        <div className="rounded-lg bg-white/60 p-3 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">Economia Est.</p>
          <p className="text-lg font-bold">{fmt$(metrics.core_roi.estimated_dev_cost_saved_usd)}</p>
        </div>
        <div className="rounded-lg bg-white/60 p-3 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">Features</p>
          <p className="text-lg font-bold">{metrics.core_roi.features_completed}</p>
        </div>
        <div className="rounded-lg bg-white/60 p-3 dark:bg-white/5">
          <p className="text-xs text-muted-foreground">Periodo</p>
          <p className="text-lg font-bold">
            {metrics.period_days === 0 ? "All" : `${metrics.period_days}d`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// ROI Trend chart (line)
// ----------------------------------------------------------------

function ROITrendChart({ snapshots }: { snapshots: ROISnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Sem dados de snapshots
      </div>
    );
  }

  // Group by ISO week
  const byWeek: Record<string, number[]> = {};
  for (const s of snapshots) {
    const d = new Date(s.date);
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const label = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    if (!byWeek[label]) byWeek[label] = [];
    byWeek[label].push(s.roi_ratio);
  }

  const data = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, vals]) => ({
      week,
      roi: parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)),
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="x" />
        <RechartsTooltip formatter={((v: number) => [`${v}x`, "ROI Ratio"]) as any} />
        <Line
          type="monotone"
          dataKey="roi"
          name="ROI Ratio"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------------
// Custo por Feature Trend chart (line)
// ----------------------------------------------------------------

function CostPerFeatureTrendChart({ snapshots }: { snapshots: ROISnapshot[] }) {
  if (snapshots.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Sem dados de snapshots
      </div>
    );
  }

  const byWeek: Record<string, number[]> = {};
  for (const s of snapshots) {
    const d = new Date(s.date);
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    const label = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
    if (!byWeek[label]) byWeek[label] = [];
    byWeek[label].push(s.cost_per_feature_usd);
  }

  const data = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, vals]) => ({
      week,
      cost: parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(4)),
    }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `$${v}`} />
        <RechartsTooltip formatter={((v: number) => [`$${v}`, "Custo/Feature"]) as any} />
        <Line
          type="monotone"
          dataKey="cost"
          name="Custo/Feature"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------------
// Comparativo por Modelo (grouped bar)
// ----------------------------------------------------------------

function ModelComparisonChart({ byModel }: { byModel: ByModelEntry[] }) {
  if (byModel.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Sem dados por modelo
      </div>
    );
  }

  const data = byModel.map((m) => ({
    model: m.model.length > 16 ? m.model.slice(0, 16) + "…" : m.model,
    "Custo ($)": parseFloat(m.cost_usd.toFixed(4)),
    "First-Pass (%)": parseFloat((m.first_pass_rate * 100).toFixed(1)),
    "Cycle Time (h)": parseFloat(m.avg_cycle_time.toFixed(1)),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="model" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <RechartsTooltip />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="Custo ($)" fill={MODEL_COLORS[0]} radius={[3, 3, 0, 0]} />
        <Bar dataKey="First-Pass (%)" fill={MODEL_COLORS[1]} radius={[3, 3, 0, 0]} />
        <Bar dataKey="Cycle Time (h)" fill={MODEL_COLORS[2]} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------------
// ROI por Sprint table
// ----------------------------------------------------------------

function SprintROITable({ sprints }: { sprints: SprintROI[] }) {
  if (sprints.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        Sem dados por sprint
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="sprint-roi-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Sprint</th>
            <th className="px-3 py-2 text-right font-medium">ROI Ratio</th>
            <th className="px-3 py-2 text-right font-medium">Custo/Feature</th>
            <th className="px-3 py-2 text-right font-medium">Features</th>
            <th className="px-3 py-2 text-right font-medium">First-Pass Rate</th>
          </tr>
        </thead>
        <tbody>
          {sprints.map((s) => (
            <tr key={s.sprint} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2 font-medium">Sprint {s.sprint}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                <span
                  className={cn(
                    "font-semibold",
                    s.roi_ratio >= 2
                      ? "text-green-600"
                      : s.roi_ratio >= 1
                      ? "text-yellow-600"
                      : "text-red-600"
                  )}
                >
                  {fmtRatio(s.roi_ratio)}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {fmt$(s.cost_per_feature)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{s.features}</td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                {fmtPct(s.first_pass_rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------
// Section title
// ----------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-foreground">{children}</h2>;
}

// ----------------------------------------------------------------
// Main ROIDashboardPage
// ----------------------------------------------------------------

export function ROIDashboardPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const [periodDays, setPeriodDays] = useState<number>(30);

  const from = useMemo(() => periodStartISO(periodDays), [periodDays]);

  const { data: metrics, isLoading: metricsLoading } = useROIMetrics(projectId, periodDays);
  const { data: snapshots = [], isLoading: snapshotsLoading } = useROISnapshots(
    projectId,
    from,
    undefined
  );
  const { data: sprints = [], isLoading: sprintsLoading } = useROIBySprint(projectId);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" data-testid="roi-dashboard">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">ROI Dashboard</h1>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1" data-testid="period-selector">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => setPeriodDays(o.days)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                periodDays === o.days
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Hero KPI */}
      {metricsLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" data-testid="hero-kpi-skeleton" />
      ) : metrics ? (
        <HeroKPI metrics={metrics} />
      ) : null}

      {/* 4 KPI Cards */}
      <section data-testid="kpi-cards">
        {metricsLoading ? (
          <KpiCardGrid>
            {[0, 1, 2, 3].map((i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </KpiCardGrid>
        ) : metrics ? (
          <KpiCardGrid>
            <KpiCard
              icon={DollarSign}
              iconClassName="bg-green-100 text-green-600"
              label="Custo por Feature"
              value={fmt$(metrics.core_roi.cost_per_feature_usd)}
              subtitle="custo AI medio"
            />
            <KpiCard
              icon={CheckCircle2}
              iconClassName="bg-indigo-100 text-indigo-600"
              label="First-Pass Accuracy"
              value={fmtPct(metrics.ai_quality.first_pass_accuracy)}
              subtitle="sem rework"
            />
            <KpiCard
              icon={RefreshCw}
              iconClassName="bg-orange-100 text-orange-600"
              label="AI Rework Ratio"
              value={fmtPct(metrics.ai_quality.ai_rework_ratio)}
              subtitle="features com rework"
            />
            <KpiCard
              icon={Clock}
              iconClassName="bg-violet-100 text-violet-600"
              label="Dev Hours Economizadas"
              value={fmtHours(metrics.core_roi.estimated_dev_hours_saved)}
              subtitle="estimativa baseline"
            />
          </KpiCardGrid>
        ) : null}
      </section>

      {/* Charts row 1: ROI Trend + Custo por Feature Trend */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border p-4" data-testid="roi-trend-chart">
          <SectionTitle>ROI Trend</SectionTitle>
          <div className="mt-4">
            {snapshotsLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ROITrendChart snapshots={snapshots} />
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4" data-testid="cost-trend-chart">
          <SectionTitle>Custo por Feature Trend</SectionTitle>
          <div className="mt-4">
            {snapshotsLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <CostPerFeatureTrendChart snapshots={snapshots} />
            )}
          </div>
        </div>
      </div>

      {/* Chart: Comparativo por Modelo */}
      <div className="rounded-lg border p-4" data-testid="model-comparison-chart">
        <SectionTitle>Comparativo por Modelo</SectionTitle>
        <div className="mt-4">
          {metricsLoading ? (
            <Skeleton className="h-[220px] w-full" />
          ) : metrics ? (
            <ModelComparisonChart byModel={metrics.by_model} />
          ) : null}
        </div>
      </div>

      {/* Table: ROI por Sprint */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>ROI por Sprint</SectionTitle>
          {!sprintsLoading && (
            <span className="text-xs text-muted-foreground">{sprints.length} sprints</span>
          )}
        </div>
        {sprintsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <SprintROITable sprints={sprints} />
        )}
      </section>
    </div>
  );
}

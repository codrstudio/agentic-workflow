import { useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  Star,
  Layers,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  useThroughputMetrics,
  useBottlenecks,
  useDelegationProfile,
  useFeatureCycles,
  type ThroughputMetrics,
  type BottleneckEntry,
  type DelegationProfile,
  type FeatureCycleRecord,
} from "@/hooks/use-throughput";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-100 text-green-800 border-green-300",
  in_progress: "bg-blue-100 text-blue-800 border-blue-300",
  failed: "bg-red-100 text-red-800 border-red-300",
  skipped: "bg-gray-100 text-gray-700 border-gray-300",
};

const AI_CONTRIBUTION_COLORS: Record<string, string> = {
  full: "bg-violet-100 text-violet-800 border-violet-300",
  majority: "bg-indigo-100 text-indigo-800 border-indigo-300",
  partial: "bg-sky-100 text-sky-800 border-sky-300",
  none: "bg-gray-100 text-gray-700 border-gray-300",
};

const AI_LABELS: Record<string, string> = {
  full: "Full AI",
  majority: "Majority AI",
  partial: "Partial AI",
  none: "Human",
};

const DONUT_COLORS = ["#8b5cf6", "#6366f1", "#38bdf8", "#94a3b8"];
const DELEGATION_KEYS = ["full_ai", "majority_ai", "partial_ai", "human_driven"] as const;
const DELEGATION_LABELS: Record<string, string> = {
  full_ai: "Full AI",
  majority_ai: "Majority AI",
  partial_ai: "Partial AI",
  human_driven: "Human",
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  return `${h.toFixed(1)}h`;
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-base font-semibold text-foreground">{children}</h2>
  );
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", STATUS_COLORS[status] ?? STATUS_COLORS.skipped)}
    >
      {status.replace("_", " ")}
    </Badge>
  );
}

function AIBadge({ level }: { level: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs", AI_CONTRIBUTION_COLORS[level] ?? AI_CONTRIBUTION_COLORS.none)}
    >
      {AI_LABELS[level] ?? level}
    </Badge>
  );
}

function FirstPassBadge({ firstPass }: { firstPass: boolean }) {
  return firstPass ? (
    <Badge variant="outline" className="text-xs bg-green-100 text-green-800 border-green-300">
      <CheckCircle2 className="mr-1 h-3 w-3" />
      1st pass
    </Badge>
  ) : (
    <Badge variant="outline" className="text-xs bg-gray-100 text-gray-600 border-gray-300">
      Retry
    </Badge>
  );
}

// ----------------------------------------------------------------
// Features per Week stacked bar chart
// ----------------------------------------------------------------

function FeaturesPerWeekChart({ metrics }: { metrics: ThroughputMetrics }) {
  // Build stacked bar from features_per_week
  const data = metrics.quality.features_per_week.map((entry) => ({
    week: entry.week,
    completed: entry.count,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <RechartsTooltip />
        <Legend />
        <Bar dataKey="completed" name="Completed" stackId="a" fill="#22c55e" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------------
// Cycle Time Trend line chart
// ----------------------------------------------------------------

function CycleTimeTrendChart({ cycles }: { cycles: FeatureCycleRecord[] }) {
  // Group completed cycles by week and compute avg cycle time
  const byWeek: Record<string, number[]> = {};
  for (const c of cycles) {
    if (c.status === "completed" && c.cycle_time_hours !== null && c.completed_at) {
      const d = new Date(c.completed_at);
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
      const label = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
      if (!byWeek[label]) byWeek[label] = [];
      byWeek[label].push(c.cycle_time_hours);
    }
  }

  const data = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, values]) => ({
      week,
      avg: parseFloat((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)),
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No cycle time data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} unit="h" />
        <RechartsTooltip formatter={(v: number) => [`${v}h`, "Avg Cycle Time"]} />
        <Line type="monotone" dataKey="avg" name="Avg Cycle Time" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------------
// Feature Cycles Table
// ----------------------------------------------------------------

function FeatureCyclesTable({ cycles }: { cycles: FeatureCycleRecord[] }) {
  if (cycles.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No feature cycles recorded
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">Feature ID</th>
            <th className="px-3 py-2 text-left font-medium">Sprint</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Attempts</th>
            <th className="px-3 py-2 text-left font-medium">AI Contribution</th>
            <th className="px-3 py-2 text-right font-medium">Cycle Time</th>
            <th className="px-3 py-2 text-left font-medium">First Pass</th>
          </tr>
        </thead>
        <tbody>
          {cycles.map((c) => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-2 font-mono font-medium text-foreground">{c.feature_id}</td>
              <td className="px-3 py-2 text-muted-foreground">Sprint {c.sprint}</td>
              <td className="px-3 py-2">
                <StatusBadge status={c.status} />
              </td>
              <td className="px-3 py-2 text-right text-muted-foreground">{c.attempts}</td>
              <td className="px-3 py-2">
                <AIBadge level={c.ai_contribution} />
              </td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                {formatHours(c.cycle_time_hours)}
              </td>
              <td className="px-3 py-2">
                <FirstPassBadge firstPass={c.first_pass} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------
// Bottleneck Analysis
// ----------------------------------------------------------------

function BottleneckAnalysis({ bottlenecks }: { bottlenecks: BottleneckEntry[] }) {
  if (bottlenecks.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No bottleneck data available
      </div>
    );
  }

  const maxDuration = Math.max(...bottlenecks.map((b) => b.avg_duration_hours), 1);

  return (
    <div className="space-y-3">
      {bottlenecks.map((b) => (
        <div key={b.phase} className="rounded-lg border p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-sm font-medium capitalize">{b.phase}</span>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{b.features_affected} features</span>
              <span className="text-red-600">{formatPct(b.failure_rate)} failure</span>
              <span>{formatHours(b.avg_duration_hours)} avg</span>
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-orange-400"
              style={{ width: `${(b.avg_duration_hours / maxDuration) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ----------------------------------------------------------------
// Delegation Dashboard (sub-tab)
// ----------------------------------------------------------------

function DelegationDashboard({ slug, periodDays }: { slug: string; periodDays: number }) {
  const { data: profile, isLoading } = useDelegationProfile(slug, periodDays);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
        No delegation data available
      </div>
    );
  }

  // Donut chart data
  const donutData = DELEGATION_KEYS.map((key, i) => ({
    name: DELEGATION_LABELS[key],
    value: profile.distribution[key],
    color: DONUT_COLORS[i],
  })).filter((d) => d.value > 0);

  // Bar chart rework by delegation
  const reworkData = DELEGATION_KEYS.map((key, i) => ({
    name: DELEGATION_LABELS[key],
    rework: parseFloat((profile.rework_by_delegation[key] * 100).toFixed(1)),
    color: DONUT_COLORS[i],
  }));

  return (
    <div className="space-y-6">
      {/* Sweet Spot Card */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900 dark:bg-violet-950/30">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-violet-100 p-2 dark:bg-violet-900/50">
            <Star className="h-5 w-5 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-violet-900 dark:text-violet-200">
              Sweet Spot: {profile.sweet_spot}
            </p>
            <p className="mt-1 text-sm text-violet-700 dark:text-violet-300">
              {profile.sweet_spot_insight}
            </p>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Donut distribution */}
        <div className="rounded-lg border p-4">
          <SectionTitle>Distribuicao de Delegacao</SectionTitle>
          <div className="mt-4 flex flex-col items-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Rework by delegation level */}
        <div className="rounded-lg border p-4">
          <SectionTitle>Rework por Nivel de Delegacao</SectionTitle>
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={reworkData}
                margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <RechartsTooltip formatter={(v: number) => [`${v}%`, "Rework Rate"]} />
                <Bar dataKey="rework" name="Rework Rate" radius={[3, 3, 0, 0]}>
                  {reworkData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary row */}
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">
          Total de features no periodo: <strong>{profile.total_features}</strong>
        </p>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Main ThroughputDashboard
// ----------------------------------------------------------------

type ActiveTab = "throughput" | "delegacao";

export function ThroughputDashboardPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const [periodDays, setPeriodDays] = useState<number>(30);
  const [activeTab, setActiveTab] = useState<ActiveTab>("throughput");

  const { data: metrics, isLoading: metricsLoading } = useThroughputMetrics(projectId, periodDays);
  const { data: bottlenecksData, isLoading: bottlenecksLoading } = useBottlenecks(projectId);
  const { data: cyclesData, isLoading: cyclesLoading } = useFeatureCycles(projectId, { limit: 100 });

  const cycles = cyclesData?.cycles ?? [];
  const bottlenecks = bottlenecksData?.bottlenecks ?? [];

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" data-testid="throughput-dashboard">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">Throughput Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {PERIOD_OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setPeriodDays(o.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                periodDays === o.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b">
        {(["throughput", "delegacao"] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px",
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab === "delegacao" ? "Delegacao" : "Throughput"}
          </button>
        ))}
      </div>

      {/* Throughput tab */}
      {activeTab === "throughput" && (
        <div className="space-y-6">
          {/* KPI Cards */}
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
                  icon={CheckCircle2}
                  iconClassName="bg-green-100 text-green-600"
                  label="Features Completadas"
                  value={String(metrics.feature_level.completed)}
                  subtitle={`no periodo de ${periodDays}d`}
                />
                <KpiCard
                  icon={Clock}
                  iconClassName="bg-blue-100 text-blue-600"
                  label="Cycle Time Medio"
                  value={formatHours(metrics.feature_level.avg_cycle_time_hours)}
                  subtitle="por feature"
                />
                <KpiCard
                  icon={TrendingUp}
                  iconClassName="bg-violet-100 text-violet-600"
                  label="First-Pass Rate"
                  value={formatPct(metrics.feature_level.first_pass_rate)}
                  subtitle="sem rework"
                />
                <KpiCard
                  icon={RefreshCw}
                  iconClassName="bg-orange-100 text-orange-600"
                  label="AI Rework Ratio"
                  value={formatPct(metrics.ai_effectiveness.rework_ratio)}
                  subtitle="features com rework"
                />
              </KpiCardGrid>
            ) : null}
          </section>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Features por Semana */}
            <div className="rounded-lg border p-4" data-testid="features-per-week-chart">
              <SectionTitle>Features por Semana</SectionTitle>
              <div className="mt-4">
                {metricsLoading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : metrics ? (
                  <FeaturesPerWeekChart metrics={metrics} />
                ) : null}
              </div>
            </div>

            {/* Cycle Time Trend */}
            <div className="rounded-lg border p-4">
              <SectionTitle>Cycle Time Trend</SectionTitle>
              <div className="mt-4">
                {cyclesLoading ? (
                  <Skeleton className="h-[220px] w-full" />
                ) : (
                  <CycleTimeTrendChart cycles={cycles} />
                )}
              </div>
            </div>
          </div>

          {/* Feature Cycles Table */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <SectionTitle>Feature Cycles</SectionTitle>
              {cyclesData && (
                <span className="text-xs text-muted-foreground">
                  {cycles.length} records
                </span>
              )}
            </div>
            {cyclesLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <FeatureCyclesTable cycles={cycles} />
            )}
          </section>

          {/* Bottleneck Analysis */}
          <section data-testid="bottleneck-analysis">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <SectionTitle>Bottleneck Analysis</SectionTitle>
            </div>
            {bottlenecksLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <BottleneckAnalysis bottlenecks={bottlenecks} />
            )}
          </section>
        </div>
      )}

      {/* Delegacao tab */}
      {activeTab === "delegacao" && (
        <DelegationDashboard slug={projectId} periodDays={periodDays} />
      )}
    </div>
  );
}

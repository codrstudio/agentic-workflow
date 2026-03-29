import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import {
  Loader2,
  Waves,
  Terminal,
  ListChecks,
  FileText,
  AlertTriangle,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  OctagonX,
} from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@workspace/ui/components/status-badge"

// --- Types ---

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
}

interface Run {
  id: string
  workflow: string
  status: "running" | "completed" | "failed"
  startedAt: string
}

interface FeatureCounters {
  passing: number
  failing: number
  skipped: number
  pending: number
  in_progress: number
  blocked: number
}

interface WaveStat {
  wave_number: number
  status: string
  steps_total: number
  steps_completed: number
  steps_failed: number
  duration_ms: number | null
  avg_step_ms: number | null
  features: FeatureCounters | null
  feature_total: number
  loop_iterations: number | null
}

interface StatsData {
  wave_stats: WaveStat[]
  crash_count: number
  feature_totals: (FeatureCounters & { total: number }) | null
}

// --- Helpers ---

function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`
  const h = Math.floor(ms / 3_600_000)
  const m = Math.round((ms % 3_600_000) / 60_000)
  return `${h}h ${m}m`
}

function formatDurationShort(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`
  return `${(ms / 3_600_000).toFixed(1)}h`
}

const STATUS_COLORS: Record<string, string> = {
  completed: "var(--color-green-500, #22c55e)",
  running: "var(--color-blue-500, #3b82f6)",
  failed: "var(--color-red-500, #ef4444)",
  interrupted: "var(--color-amber-500, #f59e0b)",
  pending: "var(--color-zinc-400, #a1a1aa)",
}

const FEATURE_COLORS: Record<string, string> = {
  passing: "#22c55e",
  failing: "#ef4444",
  skipped: "#a1a1aa",
  pending: "#71717a",
  in_progress: "#3b82f6",
  blocked: "#f59e0b",
}

const FEATURE_LABELS: Record<string, string> = {
  passing: "Passing",
  failing: "Failing",
  skipped: "Skipped",
  pending: "Pending",
  in_progress: "Em progresso",
  blocked: "Blocked",
}

// --- Component ---

export function ProjectDetailPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug" })

  const [project, setProject] = useState<Project | null>(null)
  const [runs, setRuns] = useState<Run[]>([])
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}`).then((r) => r.json() as Promise<Project>),
      apiFetch(`/api/v1/projects/${slug}/runs`)
        .then((r) => r.json() as Promise<Run[]>)
        .catch(() => [] as Run[]),
      apiFetch(`/api/v1/projects/${slug}/stats`)
        .then((r) => (r.ok ? (r.json() as Promise<StatsData>) : null))
        .catch(() => null),
    ])
      .then(([p, r, s]) => {
        setProject(p)
        setRuns(r)
        setStats(s)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-6">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-64 bg-muted rounded-lg animate-pulse" />
          <div className="h-64 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col p-6">
        <p className="text-destructive text-sm" role="alert">
          {error ?? "Projeto não encontrado"}
        </p>
      </div>
    )
  }

  const waveStats = stats?.wave_stats ?? []
  const activeRuns = runs.filter((r) => r.status === "running")

  const totalWaves = waveStats.length
  const completedWaves = waveStats.filter((w) => w.status === "completed").length
  const failedWaves = waveStats.filter((w) => w.status === "failed").length
  const crashCount = stats?.crash_count ?? 0
  const featureTotals = stats?.feature_totals

  // Compute total duration
  const totalDuration = waveStats.reduce((sum, w) => sum + (w.duration_ms ?? 0), 0)

  // Compute average wave duration (completed only)
  const completedDurations = waveStats
    .filter((w) => w.status === "completed" && w.duration_ms)
    .map((w) => w.duration_ms!)
  const avgWaveDuration = completedDurations.length > 0
    ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length
    : 0

  // Duration trend (last 3 vs previous 3)
  let durationTrend: "up" | "down" | "flat" = "flat"
  if (completedDurations.length >= 4) {
    const recent = completedDurations.slice(-3)
    const previous = completedDurations.slice(-6, -3)
    if (previous.length >= 2) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
      const prevAvg = previous.reduce((a, b) => a + b, 0) / previous.length
      durationTrend = recentAvg > prevAvg * 1.1 ? "up" : recentAvg < prevAvg * 0.9 ? "down" : "flat"
    }
  }

  // Wave duration chart data
  const durationChartData = waveStats
    .filter((w) => w.duration_ms !== null)
    .map((w) => ({
      name: `W${w.wave_number}`,
      wave: w.wave_number,
      duration: Math.round((w.duration_ms ?? 0) / 60_000),
      status: w.status,
      raw_ms: w.duration_ms ?? 0,
    }))

  // Feature donut data
  const featureDonutData = featureTotals
    ? (Object.entries(featureTotals) as [string, number][])
        .filter(([key, val]) => key !== "total" && val > 0)
        .map(([key, val]) => ({
          name: FEATURE_LABELS[key] ?? key,
          value: val,
          fill: FEATURE_COLORS[key] ?? "#71717a",
        }))
    : []

  // Feature progress per wave (stacked area)
  const featureProgressData = waveStats
    .filter((w) => w.features !== null)
    .map((w) => ({
      name: `W${w.wave_number}`,
      passing: w.features!.passing,
      failing: w.features!.failing,
      skipped: w.features!.skipped,
      pending: w.features!.pending + w.features!.blocked,
    }))

  // Success rate
  const successRate = totalWaves > 0
    ? Math.round((completedWaves / totalWaves) * 100)
    : 0

  // Feature pass rate
  const featurePassRate = featureTotals && featureTotals.total > 0
    ? Math.round((featureTotals.passing / featureTotals.total) * 100)
    : null

  return (
    <div className="flex flex-col p-6 gap-6">
      {/* Header */}
      <section className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        {activeRuns.length > 0 && (
          <Link
            to="/projects/$slug/monitor"
            params={{ slug }}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 hover:bg-blue-500/20 transition-colors"
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {activeRuns.length} ativa(s)
          </Link>
        )}
      </section>

      {/* Stats cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Waves"
          value={totalWaves}
          sub={completedWaves > 0 ? `${successRate}% sucesso` : undefined}
          icon={<Waves className="w-4 h-4" />}
        />
        <StatCard
          label="Completadas"
          value={completedWaves}
          color="text-green-600 dark:text-green-400"
          icon={<Activity className="w-4 h-4" />}
        />
        <StatCard
          label="Falharam"
          value={failedWaves}
          color={failedWaves > 0 ? "text-red-600 dark:text-red-400" : undefined}
          icon={<AlertTriangle className="w-4 h-4" />}
        />
        <StatCard
          label="Crashes"
          value={crashCount}
          color={crashCount > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
          icon={<OctagonX className="w-4 h-4" />}
          linkTo={`/projects/${slug}/crashes`}
        />
        <StatCard
          label="Features"
          value={featureTotals ? `${featureTotals.passing}/${featureTotals.total}` : "-"}
          sub={featurePassRate !== null ? `${featurePassRate}% passing` : undefined}
          color={featurePassRate !== null && featurePassRate >= 80 ? "text-green-600 dark:text-green-400" : undefined}
          icon={<Zap className="w-4 h-4" />}
        />
        <StatCard
          label="Duração total"
          value={totalDuration > 0 ? formatDuration(totalDuration) : "-"}
          sub={avgWaveDuration > 0 ? `~${formatDuration(avgWaveDuration)}/wave` : undefined}
          icon={
            durationTrend === "down" ? <TrendingDown className="w-4 h-4 text-green-500" /> :
            durationTrend === "up" ? <TrendingUp className="w-4 h-4 text-amber-500" /> :
            <Clock className="w-4 h-4" />
          }
        />
      </section>

      {/* Charts row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Wave Duration Chart */}
        {durationChartData.length > 1 && (
          <div className="lg:col-span-2 bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Duração por Wave (min)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={durationChartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number, _name: string, props: { payload?: { raw_ms?: number } }) => {
                    const raw = props.payload?.raw_ms
                    return [raw ? formatDuration(raw) : `${value}min`, "Duração"]
                  }}
                  labelFormatter={(label: string) => `Wave ${label.replace("W", "")}`}
                />
                <Bar dataKey="duration" radius={[4, 4, 0, 0]} maxBarSize={40}>
                  {durationChartData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={STATUS_COLORS[entry.status] ?? STATUS_COLORS.pending!}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Feature Donut */}
        {featureDonutData.length > 0 && (
          <div className="bg-card border rounded-lg p-4 flex flex-col items-center">
            <h3 className="text-sm font-medium text-muted-foreground mb-1 self-start">Features</h3>
            <div className="relative">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie
                    data={featureDonutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {featureDonutData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold tabular-nums">
                  {featurePassRate ?? 0}%
                </span>
                <span className="text-[10px] text-muted-foreground">pass rate</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 justify-center">
              {featureDonutData.map((d) => (
                <div key={d.name} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </div>
        )}

        {/* If no duration chart data, show placeholder */}
        {durationChartData.length <= 1 && featureDonutData.length === 0 && (
          <div className="lg:col-span-3 bg-card border rounded-lg p-8 flex items-center justify-center text-muted-foreground text-sm">
            Dados insuficientes para gráficos. Execute mais waves para ver análises.
          </div>
        )}
      </section>

      {/* Feature progress over waves */}
      {featureProgressData.length > 1 && (
        <section className="bg-card border rounded-lg p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Evolução de Features por Wave</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={featureProgressData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="passing" stackId="1" fill="#22c55e" stroke="#22c55e" fillOpacity={0.6} />
              <Area type="monotone" dataKey="failing" stackId="1" fill="#ef4444" stroke="#ef4444" fillOpacity={0.6} />
              <Area type="monotone" dataKey="skipped" stackId="1" fill="#a1a1aa" stroke="#a1a1aa" fillOpacity={0.4} />
              <Area type="monotone" dataKey="pending" stackId="1" fill="#71717a" stroke="#71717a" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 justify-center">
            {[
              { label: "Passing", color: "#22c55e" },
              { label: "Failing", color: "#ef4444" },
              { label: "Skipped", color: "#a1a1aa" },
              { label: "Pending", color: "#71717a" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent waves table */}
      {waveStats.length > 0 && (
        <section className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium text-muted-foreground">Waves Recentes</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left px-4 py-2 font-medium">#</th>
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                  <th className="text-left px-4 py-2 font-medium">Steps</th>
                  <th className="text-left px-4 py-2 font-medium">Duração</th>
                  <th className="text-left px-4 py-2 font-medium">Features</th>
                  <th className="text-left px-4 py-2 font-medium">Iterações</th>
                </tr>
              </thead>
              <tbody>
                {waveStats.slice().reverse().slice(0, 8).map((w) => (
                  <tr key={w.wave_number} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-2">
                      <Link
                        to="/projects/$slug/waves/$waveNumber"
                        params={{ slug, waveNumber: String(w.wave_number) }}
                        className="font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {w.wave_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <StatusBadge status={w.status} />
                    </td>
                    <td className="px-4 py-2 tabular-nums text-xs">
                      {w.steps_completed}/{w.steps_total}
                      {w.steps_failed > 0 && (
                        <span className="text-red-500 ml-1">({w.steps_failed} err)</span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground">
                      {w.duration_ms ? formatDurationShort(w.duration_ms) : "-"}
                    </td>
                    <td className="px-4 py-2">
                      {w.features ? (
                        <div className="flex items-center gap-1.5">
                          <FeatureMiniBar features={w.features} total={w.feature_total} />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {w.features.passing}/{w.feature_total}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground">
                      {w.loop_iterations ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {waveStats.length > 8 && (
            <Link
              to="/projects/$slug/waves"
              params={{ slug }}
              className="block px-4 py-2 text-center text-xs text-blue-600 dark:text-blue-400 hover:bg-muted/50 border-t"
            >
              Ver todas as {waveStats.length} waves
            </Link>
          )}
        </section>
      )}

      {/* Quick links */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <QuickLink to="/projects/$slug/waves" slug={slug} icon={Waves} label="Waves" sub={`${totalWaves} total`} />
        <QuickLink to="/projects/$slug/console" slug={slug} icon={Terminal} label="Console" />
        <QuickLink to="/projects/$slug/sprints" slug={slug} icon={ListChecks} label="Sprints" />
        <QuickLink to="/projects/$slug/info" slug={slug} icon={FileText} label="Projeto" />
      </section>
    </div>
  )
}

// --- Sub-components ---

function StatCard({
  label,
  value,
  sub,
  color,
  icon,
  linkTo,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
  icon?: React.ReactNode
  linkTo?: string
}) {
  const content = (
    <div className="bg-card border rounded-lg p-4 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className="text-muted-foreground">{icon}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${color ?? ""}`}>{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className="hover:ring-1 hover:ring-border rounded-lg transition-shadow">
        {content}
      </Link>
    )
  }
  return content
}

function FeatureMiniBar({
  features,
  total,
}: {
  features: FeatureCounters
  total: number
}) {
  if (total === 0) return null

  const segments = [
    { count: features.passing, color: "#22c55e" },
    { count: features.failing, color: "#ef4444" },
    { count: features.in_progress, color: "#3b82f6" },
    { count: features.skipped, color: "#a1a1aa" },
    { count: features.pending + features.blocked, color: "#52525b" },
  ].filter((s) => s.count > 0)

  return (
    <div className="flex h-2 w-16 rounded-full overflow-hidden bg-muted">
      {segments.map((s, i) => (
        <div
          key={i}
          className="h-full"
          style={{
            width: `${(s.count / total) * 100}%`,
            backgroundColor: s.color,
          }}
        />
      ))}
    </div>
  )
}

function QuickLink({
  to,
  slug,
  icon: Icon,
  label,
  sub,
}: {
  to: string
  slug: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  sub?: string
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      className="bg-card border rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
    >
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-sm font-medium">{label}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Link>
  )
}

import { useEffect, useState, useCallback } from "react"
import { CheckCircle2, XCircle, SkipForward, Clock, Loader2, Ban } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useSSEContext } from "@/contexts/sse-context"

type FeatureStatus = "passing" | "failing" | "skipped" | "pending" | "blocked" | "in_progress"

interface Feature {
  id: string
  name: string
  status: FeatureStatus
  priority?: number
}

interface LoopState {
  status?: string
  current_feature?: string
  features_done?: number
  total?: number
  iteration?: number
  started_at?: string
  updated_at?: string
}

interface LoopCounters {
  passing: number
  failing: number
  skipped: number
  pending: number
  blocked: number
  in_progress: number
}

interface LoopData {
  loop: LoopState
  features: Feature[]
  counters: LoopCounters
}

// ---- Sub-components ----

function ProgressRing({ percent }: { percent: number }) {
  const radius = 40
  const cx = 52
  const cy = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (percent / 100) * circumference

  return (
    <svg
      width="104"
      height="104"
      viewBox="0 0 104 104"
      className="shrink-0"
      aria-label={`${percent}% concluído`}
    >
      {/* Track */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        className="stroke-muted"
        strokeWidth="8"
      />
      {/* Progress */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        className="stroke-primary transition-all duration-500"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      {/* Percentage label */}
      <text
        x={cx}
        y={cy + 6}
        textAnchor="middle"
        className="fill-foreground text-sm font-semibold"
        fontSize="18"
        fontWeight="600"
      >
        {percent}%
      </text>
    </svg>
  )
}

function StatusBadge({ status }: { status: FeatureStatus }) {
  const map: Record<FeatureStatus, { label: string; className: string }> = {
    passing: { label: "passing", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
    failing: { label: "failing", className: "bg-red-500/15 text-red-700 dark:text-red-400" },
    skipped: { label: "skipped", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
    pending: { label: "pending", className: "bg-muted text-muted-foreground" },
    blocked: { label: "blocked", className: "bg-muted text-muted-foreground/60" },
    in_progress: { label: "running", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  }
  const { label, className } = map[status] ?? map.pending
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${className}`}
    >
      {label}
    </span>
  )
}

function FeatureStatusIcon({ status }: { status: FeatureStatus }) {
  if (status === "passing") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
  if (status === "failing") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  if (status === "skipped") return <SkipForward className="w-4 h-4 text-yellow-500 shrink-0" />
  if (status === "in_progress") return <Loader2 className="w-4 h-4 text-blue-500 shrink-0 animate-spin" />
  if (status === "blocked") return <Ban className="w-4 h-4 text-muted-foreground/40 shrink-0" />
  return <Clock className="w-4 h-4 text-muted-foreground/40 shrink-0" />
}

function CounterPill({
  value,
  label,
  colorClass,
}: {
  value: number
  label: string
  colorClass: string
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className={`text-xl font-bold tabular-nums leading-none ${colorClass}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </div>
  )
}

// ---- Main component ----

interface FeatureLoopDashboardProps {
  slug: string
  waveNumber: string
}

export function FeatureLoopDashboard({ slug, waveNumber }: FeatureLoopDashboardProps) {
  const [data, setData] = useState<LoopData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { subscribe } = useSSEContext()

  const fetchLoop = useCallback(() => {
    apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}/loop`)
      .then((r) => {
        if (!r.ok) throw new Error(`Loop state not available (${r.status})`)
        return r.json() as Promise<LoopData>
      })
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug, waveNumber])

  useEffect(() => {
    fetchLoop()
  }, [fetchLoop])

  // Re-fetch on any engine event or run events — keeps data fresh reactively
  useEffect(() => {
    const unsubs = [
      subscribe("engine:event", fetchLoop),
      subscribe("run:completed", fetchLoop),
      subscribe("run:failed", fetchLoop),
    ]
    return () => unsubs.forEach((u) => u())
  }, [subscribe, fetchLoop])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 mt-4 animate-pulse">
        <div className="h-24 bg-muted rounded-xl" />
        <div className="h-40 bg-muted rounded-xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-muted-foreground mt-2" role="alert">
        {error ?? "Loop state unavailable."}
      </p>
    )
  }

  const { loop, features, counters } = data
  const total = features.length
  const done = counters.passing + counters.failing + counters.skipped
  const percent = total > 0 ? Math.round((counters.passing / total) * 100) : 0
  const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="flex flex-col gap-5">
      {/* Progress area */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-xl border bg-card p-4">
        {/* Ring */}
        <ProgressRing percent={percent} />

        {/* Info */}
        <div className="flex flex-col gap-4 flex-1 min-w-0 w-full">
          {/* Status label */}
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Status do loop</p>
            <p className="text-sm font-medium capitalize">
              {loop.status ?? "—"}
              {loop.current_feature && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  › {loop.current_feature}
                </span>
              )}
            </p>
          </div>

          {/* Counters row */}
          <div className="flex flex-wrap gap-4">
            <CounterPill
              value={counters.passing}
              label="passing"
              colorClass="text-green-600 dark:text-green-400"
            />
            <CounterPill
              value={counters.failing}
              label="failing"
              colorClass="text-red-600 dark:text-red-400"
            />
            <CounterPill
              value={counters.skipped}
              label="skipped"
              colorClass="text-yellow-600 dark:text-yellow-400"
            />
            <CounterPill
              value={counters.pending + counters.blocked}
              label="pending"
              colorClass="text-muted-foreground"
            />
          </div>

          {/* Overall progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Progresso geral ({done}/{total})</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Feature list */}
      {features.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Features ({total})
          </p>
          <div className="flex flex-col divide-y divide-border rounded-xl border overflow-hidden">
            {features.map((f) => (
              <div
                key={f.id}
                className={[
                  "flex items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                  f.status === "in_progress"
                    ? "bg-blue-500/8 dark:bg-blue-500/10 border-l-2 border-l-blue-500"
                    : "hover:bg-muted/50",
                ].join(" ")}
              >
                <FeatureStatusIcon status={f.status} />
                <span
                  className={[
                    "font-mono text-[11px] shrink-0 w-12 text-muted-foreground",
                  ].join("")}
                >
                  {f.id}
                </span>
                <span
                  className={[
                    "flex-1 min-w-0 truncate",
                    f.status === "in_progress" ? "font-medium" : "",
                    f.status === "blocked" || f.status === "pending"
                      ? "text-muted-foreground"
                      : "",
                  ].join(" ")}
                >
                  {f.name}
                </span>
                <StatusBadge status={f.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

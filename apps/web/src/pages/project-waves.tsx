import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { CheckCircle2, XCircle, Loader2, Circle, AlertTriangle } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"

type WaveStatus = "pending" | "running" | "completed" | "failed" | "interrupted"

interface Wave {
  wave_number: number
  status: WaveStatus
  steps_total: number
  steps_completed: number
  steps_failed: number
}

interface Run {
  id: string
  slug: string
  workflow: string
  pid: number
  status: "running" | "completed" | "failed"
  mode: "spawn" | "detached"
  startedAt: string
  completedAt?: string
}

function WaveStatusIcon({ status }: { status: WaveStatus }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-green-500" />
  if (status === "failed") return <XCircle className="w-4 h-4 text-red-500" />
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
  if (status === "interrupted") return <AlertTriangle className="w-4 h-4 text-amber-500" />
  return <Circle className="w-4 h-4 text-muted-foreground/40" />
}

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const seconds = Math.floor((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

export function ProjectWavesPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/waves" })

  const [waves, setWaves] = useState<Wave[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}/waves`)
        .then((r) => (r.ok ? (r.json() as Promise<Wave[]>) : Promise.resolve([])))
        .catch(() => [] as Wave[]),
      apiFetch(`/api/v1/projects/${slug}/runs`)
        .then((r) => r.json() as Promise<Run[]>)
        .catch(() => [] as Run[]),
    ])
      .then(([w, r]) => {
        setWaves(w)
        setRuns(r)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const handleStop = async (runId: string) => {
    setStoppingIds((prev) => new Set(prev).add(runId))
    try {
      await apiFetch(`/api/v1/projects/${slug}/runs/${runId}`, { method: "DELETE" })
      const runsData = await apiFetch(`/api/v1/projects/${slug}/runs`).then(
        (r) => r.json() as Promise<Run[]>,
      )
      setRuns(runsData)
    } finally {
      setStoppingIds((prev) => {
        const next = new Set(prev)
        next.delete(runId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-4">
        <div className="h-5 bg-muted rounded w-1/4 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col p-6">
        <p className="text-destructive text-sm" role="alert">{error}</p>
      </div>
    )
  }

  const activeRuns = runs.filter((r) => r.status === "running")
  const finishedRuns = runs.filter((r) => r.status !== "running")

  return (
    <div className="flex flex-col p-6 gap-8 max-w-3xl">
      {/* Active runs */}
      {activeRuns.length > 0 && (
        <section className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Execuções Ativas
            <span className="ml-1 text-xs font-normal">({activeRuns.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {activeRuns.map((run) => (
              <div
                key={run.id}
                className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={run.status} />
                    <span className="text-xs font-mono text-muted-foreground">PID {run.pid}</span>
                    <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                      run.mode === "spawn"
                        ? "bg-muted text-muted-foreground"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}>
                      {run.mode ?? "detached"}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDuration(run.startedAt)}</span>
                  </div>
                  <span className="text-xs font-mono truncate">{run.workflow}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStop(run.id)}
                  disabled={stoppingIds.has(run.id)}
                  className="shrink-0 px-3 py-1.5 rounded border text-xs font-medium hover:bg-destructive hover:text-destructive-foreground hover:border-destructive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {stoppingIds.has(run.id) ? "Parando..." : "Parar"}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Waves list */}
      <section>
        <h2 className="text-sm font-semibold mb-3">Waves</h2>
        {waves.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma wave encontrada.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {waves.map((wave) => {
              const progress =
                wave.steps_total > 0
                  ? Math.round((wave.steps_completed / wave.steps_total) * 100)
                  : 0
              return (
                <Link
                  key={wave.wave_number}
                  to="/projects/$slug/waves/$waveNumber"
                  params={{ slug, waveNumber: String(wave.wave_number) }}
                  className="group bg-card border rounded-lg px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
                >
                  <WaveStatusIcon status={wave.status} />
                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">Wave {wave.wave_number}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {wave.steps_completed}/{wave.steps_total} steps
                        {wave.steps_failed > 0 && (
                          <span className="text-red-500 ml-1">· {wave.steps_failed} erro</span>
                        )}
                      </span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </section>

      {/* Run history */}
      {finishedRuns.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Histórico</h2>
          <div className="flex flex-col gap-2">
            {finishedRuns.map((run) => (
              <div
                key={run.id}
                className="bg-card border rounded-lg px-4 py-3 flex items-center gap-4"
              >
                <StatusBadge status={run.status} />
                <span className="text-xs font-mono text-muted-foreground">PID {run.pid}</span>
                <span className="text-xs font-mono truncate text-muted-foreground">{run.workflow}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDuration(run.startedAt, run.completedAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

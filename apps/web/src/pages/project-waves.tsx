import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { CheckCircle2, XCircle, Loader2, Circle, AlertTriangle, Clock, X, Link2, ArrowRight, ExternalLink } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { useSSEContext } from "@/contexts/sse-context"

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

interface QueuedRun {
  id: string
  slug: string
  workflow: string
  queuedAt: string
}

interface Trigger {
  id: string
  targetSlug: string
  targetWorkflow: string
  sourceSlug: string
  sourceWorkflow?: string
  createdAt: string
}

interface SourceProjectInfo {
  name: string
  slug: string
  status?: string
  runStatus?: "idle" | "running" | "completed" | "failed"
  stepsCompleted?: number
  stepsTotal?: number
  workflow?: string
  startedAt?: string
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
  const [queue, setQueue] = useState<QueuedRun[]>([])
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [sourceProjects, setSourceProjects] = useState<Map<string, SourceProjectInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [removingTriggerIds, setRemovingTriggerIds] = useState<Set<string>>(new Set())

  const { subscribe } = useSSEContext()

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
      apiFetch(`/api/v1/projects/${slug}/runs/queue`)
        .then((r) => (r.ok ? (r.json() as Promise<QueuedRun[]>) : Promise.resolve([])))
        .catch(() => [] as QueuedRun[]),
      apiFetch(`/api/v1/triggers?target=${slug}`)
        .then((r) => (r.ok ? (r.json() as Promise<Trigger[]>) : Promise.resolve([])))
        .catch(() => [] as Trigger[]),
    ])
      .then(([w, r, q, t]) => {
        setWaves(w)
        setRuns(r)
        setQueue(q)
        setTriggers(t)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  // Fetch source project info for triggers
  const fetchSourceInfo = useCallback(async (sourceSlugs: string[]) => {
    const unique = [...new Set(sourceSlugs)]
    const entries = await Promise.all(
      unique.map(async (s) => {
        try {
          const [projRes, runsRes] = await Promise.all([
            apiFetch(`/api/v1/projects/${s}`).then((r) => r.json() as Promise<{ name: string; slug: string; status?: string }>),
            apiFetch(`/api/v1/projects/${s}/runs`).then((r) => r.json() as Promise<Run[]>),
          ])
          const activeRun = runsRes.find((r: Run) => r.status === "running")
          const info: SourceProjectInfo = {
            name: projRes.name,
            slug: projRes.slug,
            status: projRes.status,
            runStatus: activeRun ? "running" : "idle",
            workflow: activeRun?.workflow,
            startedAt: activeRun?.startedAt,
          }
          // If running, fetch wave progress
          if (activeRun) {
            try {
              const wavesRes = await apiFetch(`/api/v1/projects/${s}/waves`).then((r) => r.json() as Promise<Wave[]>)
              const runningWave = wavesRes.find((w: Wave) => w.status === "running")
              if (runningWave) {
                info.stepsCompleted = runningWave.steps_completed
                info.stepsTotal = runningWave.steps_total
              }
            } catch { /* ignore */ }
          }
          return [s, info] as const
        } catch {
          return [s, { name: s, slug: s, runStatus: "idle" as const }] as const
        }
      }),
    )
    setSourceProjects(new Map(entries))
  }, [])

  useEffect(() => {
    if (triggers.length === 0) return
    fetchSourceInfo(triggers.map((t) => t.sourceSlug)).catch(() => {})
  }, [triggers, fetchSourceInfo])

  // SSE: react to queue changes
  useEffect(() => {
    const unsub1 = subscribe("run:queued", (event) => {
      const data = event.data as { id: string; slug: string; workflow: string }
      if (data.slug !== slug) return
      setQueue((prev) => [...prev, { id: data.id, slug: data.slug, workflow: data.workflow, queuedAt: new Date().toISOString() }])
    })
    const unsub2 = subscribe("run:dequeued", (event) => {
      const data = event.data as { id: string; slug: string }
      if (data.slug !== slug) return
      setQueue((prev) => prev.filter((item) => item.id !== data.id))
    })
    // Refresh runs on run:started / run:completed / run:failed
    const refreshRuns = (event: { data: unknown }) => {
      const data = event.data as { slug?: string }
      if (data.slug !== slug) return
      apiFetch(`/api/v1/projects/${slug}/runs`)
        .then((r) => r.json() as Promise<Run[]>)
        .then(setRuns)
        .catch(() => {})
    }
    const unsub3 = subscribe("run:started", refreshRuns)
    const unsub4 = subscribe("run:completed", refreshRuns)
    const unsub5 = subscribe("run:failed", refreshRuns)
    const unsub6 = subscribe("run:trigger:created", (event) => {
      const data = event.data as { id: string; targetSlug: string; targetWorkflow: string; sourceSlug: string; sourceWorkflow?: string }
      if (data.targetSlug !== slug) return
      setTriggers((prev) => [...prev, { ...data, createdAt: new Date().toISOString() }])
    })
    const unsub7 = subscribe("run:trigger:removed", (event) => {
      const data = event.data as { id: string }
      setTriggers((prev) => prev.filter((t) => t.id !== data.id))
    })
    const unsub8 = subscribe("run:triggered", (event) => {
      const data = event.data as { triggerId: string }
      setTriggers((prev) => prev.filter((t) => t.id !== data.triggerId))
    })
    // Update source project progress from monitor snapshots
    const unsub9 = subscribe("monitor:snapshot", (event) => {
      const data = event.data as { project_slug?: string; data?: { current_wave?: { number: number; status: string; steps: Array<{ status: string }> } } }
      if (!data.project_slug || !data.data?.current_wave) return
      setSourceProjects((prev) => {
        const existing = prev.get(data.project_slug!)
        if (!existing) return prev
        const wave = data.data!.current_wave!
        const stepsTotal = wave.steps.length
        const stepsCompleted = wave.steps.filter((s) => s.status === "completed").length
        const next = new Map(prev)
        next.set(data.project_slug!, { ...existing, runStatus: "running", stepsCompleted, stepsTotal })
        return next
      })
    })
    // Update source status on run events from other projects
    const updateSourceOnRunEvent = (event: { data: unknown }) => {
      const data = event.data as { slug?: string }
      if (!data.slug) return
      setSourceProjects((prev) => {
        const existing = prev.get(data.slug!)
        if (!existing) return prev
        // Refetch to get accurate state
        fetchSourceInfo([data.slug!]).catch(() => {})
        return prev
      })
    }
    const unsub10 = subscribe("run:started", updateSourceOnRunEvent)
    const unsub11 = subscribe("run:completed", updateSourceOnRunEvent)
    const unsub12 = subscribe("run:failed", updateSourceOnRunEvent)
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6(); unsub7(); unsub8(); unsub9(); unsub10(); unsub11(); unsub12() }
  }, [slug, subscribe, fetchSourceInfo])

  const handleRemoveTrigger = async (triggerId: string) => {
    setRemovingTriggerIds((prev) => new Set(prev).add(triggerId))
    try {
      await apiFetch(`/api/v1/triggers/${triggerId}`, { method: "DELETE" })
      setTriggers((prev) => prev.filter((t) => t.id !== triggerId))
    } finally {
      setRemovingTriggerIds((prev) => {
        const next = new Set(prev)
        next.delete(triggerId)
        return next
      })
    }
  }

  const handleRemoveFromQueue = async (queueId: string) => {
    setRemovingIds((prev) => new Set(prev).add(queueId))
    try {
      await apiFetch(`/api/v1/projects/${slug}/runs/queue/${queueId}`, { method: "DELETE" })
      setQueue((prev) => prev.filter((item) => item.id !== queueId))
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev)
        next.delete(queueId)
        return next
      })
    }
  }

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

      {/* Queued runs */}
      {queue.length > 0 && (
        <section className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 text-amber-700 dark:text-amber-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Fila
            <span className="ml-1 text-xs font-normal">({queue.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {queue.map((item, idx) => (
              <div
                key={item.id}
                className="bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">{idx + 1}.</span>
                  <span className="text-sm font-mono truncate">{item.workflow}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFromQueue(item.id)}
                  disabled={removingIds.has(item.id)}
                  className="shrink-0 p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-muted-foreground"
                  aria-label="Remover da fila"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Triggers */}
      {triggers.length > 0 && (
        <section className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 text-purple-700 dark:text-purple-400 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Triggers
            <span className="ml-1 text-xs font-normal">({triggers.length})</span>
          </h2>
          <div className="flex flex-col gap-2">
            {triggers.map((t) => {
              const source = sourceProjects.get(t.sourceSlug)
              const sourceName = source?.name ?? t.sourceSlug
              const isSourceRunning = source?.runStatus === "running"
              const stepsProgress = source?.stepsTotal
                ? Math.round((source.stepsCompleted ?? 0) / source.stepsTotal * 100)
                : 0

              return (
                <div
                  key={t.id}
                  className="bg-card border border-border rounded-lg px-4 py-3 flex flex-col gap-2.5"
                >
                  {/* Chain visualization */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Source project */}
                      <Link
                        to="/projects/$slug/info"
                        params={{ slug: t.sourceSlug }}
                        className="inline-flex items-center gap-1 text-sm font-medium hover:text-purple-600 dark:hover:text-purple-400 transition-colors truncate"
                      >
                        {sourceName}
                        <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                      </Link>

                      {t.sourceWorkflow && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                          {t.sourceWorkflow}
                        </span>
                      )}

                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

                      {/* Target workflow */}
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-400 shrink-0">
                        {t.targetWorkflow}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveTrigger(t.id)}
                      disabled={removingTriggerIds.has(t.id)}
                      className="shrink-0 p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-muted-foreground"
                      aria-label="Remover trigger"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Source project status */}
                  <div className="flex items-center gap-2">
                    {isSourceRunning ? (
                      <>
                        <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          Em execução
                          {source?.workflow && <span className="text-muted-foreground"> · {source.workflow}</span>}
                          {source?.startedAt && <span className="text-muted-foreground"> · {formatDuration(source.startedAt)}</span>}
                        </span>
                        {source?.stepsTotal && source.stepsTotal > 0 && (
                          <>
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[120px]">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${stepsProgress}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">
                              {source.stepsCompleted}/{source.stepsTotal}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        <Circle className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          Aguardando execução de {sourceName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
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

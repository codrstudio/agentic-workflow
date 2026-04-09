import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { CheckCircle2, XCircle, Loader2, Circle, AlertTriangle, Clock, X, Link2, Activity, Play, ChevronUp, ChevronDown, ChevronRight, ClipboardList } from "lucide-react"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { useSSEContext } from "@/contexts/sse-context"

type WaveStatus = "pending" | "running" | "completed" | "failed" | "interrupted"

interface Wave {
  wave_number: number
  status: WaveStatus
  steps_total: number
  steps_completed: number
  steps_failed: number
  workflow: string | null
  prompt: string | null
  has_sprint: boolean
  sprint_name: string | null
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
  prompt?: string
}

type RunDependency =
  | { type: "specific-run"; runId: string }
  | { type: "project-completion"; sourceSlug: string }

interface QueuedRun {
  id: string
  slug: string
  workflow: string
  queuedAt: string
  prompt?: string
  dependsOn?: RunDependency
}

interface DepRunInfo {
  id: string
  slug: string
  workflow: string
  status: "running" | "queued"
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

function formatRelative(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `há ${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `há ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h}h ${m % 60}m`
  const d = Math.floor(h / 24)
  return `há ${d}d`
}

function truncatePrompt(prompt: string, maxLen = 100): string {
  const firstLine = prompt.split("\n")[0] ?? prompt
  const text = firstLine.replace(/^#+\s*/, "").trim()
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + "..."
}

// --- Unified Wave Card ---

function CompletedWaveCard({ wave, slug }: { wave: Wave; slug: string }) {
  const [expanded, setExpanded] = useState(false)
  const prompt = wave.prompt
  const progress = wave.steps_total > 0 ? Math.round((wave.steps_completed / wave.steps_total) * 100) : 0

  return (
    <Link
      to="/projects/$slug/waves/$waveNumber"
      params={{ slug, waveNumber: String(wave.wave_number) }}
      className="group bg-card border border-border rounded-lg px-4 py-3 flex flex-col gap-2 hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <WaveStatusIcon status={wave.status} />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium shrink-0">Wave {wave.wave_number}</span>
              {wave.workflow && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs font-mono text-muted-foreground truncate">{wave.workflow}</span>
                </>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {wave.steps_completed}/{wave.steps_total} steps
              {wave.steps_failed > 0 && (
                <span className="text-red-500 ml-1">· {wave.steps_failed} erro</span>
              )}
            </span>
          </div>
          {prompt ? (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded((v) => !v) }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground text-left"
            >
              <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
              <span className="truncate">{truncatePrompt(prompt)}</span>
            </button>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">sem prompt</p>
          )}
          {wave.has_sprint && (
            <Link
              to="/projects/$slug/sprints/$waveNumber"
              params={{ slug, waveNumber: String(wave.wave_number) }}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline w-fit"
              onClick={(e) => e.stopPropagation()}
            >
              <ClipboardList className="w-3 h-3" />
              {wave.sprint_name ?? "Specs"}
            </Link>
          )}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
      {expanded && prompt && (
        <div className="ml-7 rounded-md border border-border bg-muted/30 p-3 max-h-64 overflow-y-auto" onClick={(e) => { e.preventDefault(); e.stopPropagation() }}>
          <MarkdownViewer content={prompt} />
        </div>
      )}
    </Link>
  )
}

function RunningWaveCard({ wave, run, slug, onStop, stopping }: {
  wave: Wave
  run?: Run
  slug: string
  onStop?: () => void
  stopping?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const prompt = wave.prompt ?? run?.prompt
  const workflow = wave.workflow ?? run?.workflow
  const progress = wave.steps_total > 0 ? Math.round((wave.steps_completed / wave.steps_total) * 100) : 0

  return (
    <div className="bg-card border-2 border-blue-500/50 rounded-lg px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <WaveStatusIcon status="running" />
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium shrink-0">Wave {wave.wave_number}</span>
              {workflow && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs font-mono text-muted-foreground truncate">{workflow}</span>
                </>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {wave.steps_completed}/{wave.steps_total} steps
              {wave.steps_failed > 0 && (
                <span className="text-red-500 ml-1">· {wave.steps_failed} erro</span>
              )}
            </span>
          </div>
          {run && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <StatusBadge status="running" />
              <span className="font-mono">PID {run.pid}</span>
              <span className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                run.mode === "spawn"
                  ? "bg-muted text-muted-foreground"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}>
                {run.mode ?? "detached"}
              </span>
              <span>{formatDuration(run.startedAt)}</span>
            </div>
          )}
          {prompt ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground text-left"
            >
              <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
              <span className="truncate">{truncatePrompt(prompt)}</span>
            </button>
          ) : (
            <p className="text-xs text-muted-foreground/50 italic">sem prompt</p>
          )}
          {wave.has_sprint && (
            <Link
              to="/projects/$slug/sprints/$waveNumber"
              params={{ slug, waveNumber: String(wave.wave_number) }}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline w-fit"
            >
              <ClipboardList className="w-3 h-3" />
              {wave.sprint_name ?? "Specs"}
            </Link>
          )}
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        {run && (
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/projects/$slug/monitor"
              params={{ slug }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-blue-500/30 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <Activity className="w-3.5 h-3.5" />
              Monitor
            </Link>
            {onStop && (
              <button
                type="button"
                onClick={onStop}
                disabled={stopping}
                className="px-3 py-1.5 rounded border text-xs font-medium hover:bg-destructive hover:text-destructive-foreground hover:border-destructive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {stopping ? "Parando..." : "Parar"}
              </button>
            )}
          </div>
        )}
      </div>
      {expanded && prompt && (
        <div className="ml-7 rounded-md border border-border bg-muted/30 p-3 max-h-64 overflow-y-auto">
          <MarkdownViewer content={prompt} />
        </div>
      )}
    </div>
  )
}

function QueuedWaveCard({ item, index, onRemove, removing, onMoveUp, onMoveDown, isFirst, isLast }: {
  item: QueuedRun
  index?: number
  onRemove: () => void
  removing: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  isFirst?: boolean
  isLast?: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-card border border-border rounded-lg px-4 py-3 flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {index != null && (
                <span className="text-xs font-mono text-muted-foreground shrink-0">{index}.</span>
              )}
              <span className="text-sm font-mono truncate">{item.workflow}</span>
              <span className="text-[10px] text-muted-foreground shrink-0">{formatRelative(item.queuedAt)}</span>
            </div>
            {item.prompt ? (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground text-left"
              >
                <ChevronRight className={`w-3 h-3 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
                <span className="truncate">{truncatePrompt(item.prompt)}</span>
              </button>
            ) : (
              <p className="text-xs text-muted-foreground/50 italic">sem prompt</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className="p-1 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-muted-foreground"
              aria-label="Mover para cima"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className="p-1 rounded hover:bg-muted disabled:opacity-20 disabled:cursor-not-allowed transition-colors text-muted-foreground"
              aria-label="Mover para baixo"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={removing}
            className="p-1.5 rounded hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-muted-foreground"
            aria-label="Remover da fila"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && item.prompt && (
        <div className="ml-7 rounded-md border border-border bg-muted/30 p-3 max-h-64 overflow-y-auto">
          <MarkdownViewer content={item.prompt} />
        </div>
      )}
    </div>
  )
}

function DependencyLabel({ dep, depRunInfo }: { dep: RunDependency; depRunInfo: Map<string, DepRunInfo> }) {
  if (dep.type === "specific-run") {
    const info = depRunInfo.get(dep.runId)
    return (
      <div className="flex items-center gap-2 text-xs">
        <Link2 className="w-3 h-3 text-purple-500 shrink-0" />
        <span className="text-muted-foreground">Aguardando</span>
        {info ? (
          <>
            <span className="font-mono">{info.slug}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-muted-foreground">{info.workflow}</span>
            {info.status === "running" ? (
              <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
            ) : (
              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
            )}
          </>
        ) : (
          <span className="font-mono text-muted-foreground">{dep.runId.slice(0, 8)}...</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <Link2 className="w-3 h-3 text-purple-500 shrink-0" />
      <span className="text-muted-foreground">Aguardando conclusão de</span>
      <Link
        to="/projects/$slug/info"
        params={{ slug: dep.sourceSlug }}
        className="font-medium hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
      >
        {dep.sourceSlug}
      </Link>
    </div>
  )
}

// --- Collapsible section ---

function CollapsibleSection({ title, icon, count, defaultOpen, accentClass, children }: {
  title: string
  icon: React.ReactNode
  count: number
  defaultOpen?: boolean
  accentClass?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen ?? true)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-2 text-sm font-semibold mb-2 hover:opacity-80 transition-opacity ${accentClass ?? "text-muted-foreground"}`}
      >
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
        {icon}
        {title}
        <span className="text-xs font-normal">({count})</span>
      </button>
      {open && children}
    </div>
  )
}

// --- Page ---

export function ProjectWavesPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/waves" })

  const [waves, setWaves] = useState<Wave[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [queue, setQueue] = useState<QueuedRun[]>([])
  const [depRunInfo, setDepRunInfo] = useState<Map<string, DepRunInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set())
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())

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
    ])
      .then(([w, r, q]) => {
        setWaves(w)
        setRuns(r)
        setQueue(q)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  // Resolve dependency run info for queued runs with specific-run deps
  const fetchDepRunInfo = useCallback(async (queuedRuns: QueuedRun[]) => {
    const runIds = queuedRuns
      .filter((q) => q.dependsOn?.type === "specific-run")
      .map((q) => (q.dependsOn as { type: "specific-run"; runId: string }).runId)

    if (runIds.length === 0) {
      setDepRunInfo(new Map())
      return
    }

    try {
      const activeRuns = await apiFetch("/api/v1/runs/all")
        .then((r) => r.json() as Promise<Run[]>)
        .then((runs) => runs.filter((r) => r.status === "running"))
        .catch(() => [] as Run[])

      const infoMap = new Map<string, DepRunInfo>()
      for (const id of runIds) {
        const run = activeRuns.find((r) => r.id === id)
        if (run) {
          infoMap.set(id, { id: run.id, slug: run.slug, workflow: run.workflow, status: "running" })
        }
      }
      setDepRunInfo(infoMap)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    if (queue.length === 0) return
    fetchDepRunInfo(queue).catch(() => {})
  }, [queue, fetchDepRunInfo])

  // SSE subscriptions
  useEffect(() => {
    const unsub1 = subscribe("run:queued", (event) => {
      const data = event.data as { id: string; slug: string; workflow: string; prompt?: string; dependsOn?: RunDependency }
      if (data.slug !== slug) return
      setQueue((prev) => [...prev, {
        id: data.id,
        slug: data.slug,
        workflow: data.workflow,
        queuedAt: new Date().toISOString(),
        prompt: data.prompt ?? undefined,
        dependsOn: data.dependsOn ?? undefined,
      }])
    })
    const unsub2 = subscribe("run:dequeued", (event) => {
      const data = event.data as { id: string; slug: string }
      if (data.slug !== slug) return
      setQueue((prev) => prev.filter((item) => item.id !== data.id))
    })
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
    const unsub6 = subscribe("run:queue-reordered", (event) => {
      const data = event.data as { slug: string; orderedIds: string[] }
      if (data.slug !== slug) return
      setQueue((prev) => {
        const itemMap = new Map(prev.map((q) => [q.id, q]))
        const reordered: QueuedRun[] = []
        for (const id of data.orderedIds) {
          const item = itemMap.get(id)
          if (item) reordered.push(item)
        }
        for (const item of prev) {
          if (!data.orderedIds.includes(item.id)) reordered.push(item)
        }
        return reordered
      })
    })
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); unsub6() }
  }, [slug, subscribe])

  const handleReorder = useCallback(async (queueId: string, direction: "up" | "down") => {
    const regularIds = queue.filter((q) => !q.dependsOn).map((q) => q.id)
    const idx = regularIds.indexOf(queueId)
    if (idx === -1) return
    const swapIdx = direction === "up" ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= regularIds.length) return

    const newIds = [...regularIds]
    ;[newIds[idx], newIds[swapIdx]] = [newIds[swapIdx]!, newIds[idx]!]

    const depItems = queue.filter((q) => !!q.dependsOn)
    const itemMap = new Map(queue.map((q) => [q.id, q]))
    const reordered = [...newIds.map((id) => itemMap.get(id)!), ...depItems]
    setQueue(reordered)

    const allIds = reordered.map((q) => q.id)
    try {
      await apiFetch(`/api/v1/projects/${slug}/runs/queue/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: allIds }),
      })
    } catch {
      const freshQueue = await apiFetch(`/api/v1/projects/${slug}/runs/queue`).then(
        (r) => r.json() as Promise<QueuedRun[]>,
      )
      setQueue(freshQueue)
    }
  }, [queue, slug])

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

  // Categorize waves
  const completedWaves = waves.filter((w) => w.status === "completed" || w.status === "failed" || w.status === "interrupted")
  const runningWaves = waves.filter((w) => w.status === "running")

  // Split queue
  const regularQueue = queue.filter((q) => !q.dependsOn)
  const depQueue = queue.filter((q) => !!q.dependsOn)

  const hasCompleted = completedWaves.length > 0
  const hasRunning = runningWaves.length > 0 || activeRuns.length > 0
  const hasQueued = regularQueue.length > 0
  const hasDeps = depQueue.length > 0
  const isEmpty = !hasCompleted && !hasRunning && !hasQueued && !hasDeps

  return (
    <div className="flex flex-col p-6 gap-6 max-w-3xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Waves</h1>
        <Link
          to="/projects/$slug/runs/new"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          Executar Workflow
        </Link>
      </div>

      {isEmpty && (
        <p className="text-sm text-muted-foreground">Nenhuma wave encontrada.</p>
      )}

      {/* Completed waves — collapsible */}
      {hasCompleted && (
        <CollapsibleSection
          title="Concluídas"
          icon={<CheckCircle2 className="w-4 h-4" />}
          count={completedWaves.length}
          defaultOpen={!hasRunning && !hasQueued}
          accentClass="text-green-700 dark:text-green-400"
        >
          <div className="flex flex-col gap-2">
            {completedWaves.map((wave) => (
              <CompletedWaveCard
                key={wave.wave_number}
                wave={wave}
                slug={slug}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Running waves — always visible, highlighted */}
      {hasRunning && (
        <section className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 text-blue-700 dark:text-blue-400 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Em execução
          </h2>
          <div className="flex flex-col gap-2">
            {runningWaves.map((wave) => {
              // Match with first active run (typically 1:1)
              const matchedRun = activeRuns[0]
              return (
                <RunningWaveCard
                  key={wave.wave_number}
                  wave={wave}
                  run={matchedRun}
                  slug={slug}
                  onStop={matchedRun ? () => handleStop(matchedRun.id) : undefined}
                  stopping={matchedRun ? stoppingIds.has(matchedRun.id) : false}
                />
              )
            })}
            {/* Active runs without a matching wave (e.g. just started, wave not yet created) */}
            {runningWaves.length === 0 && activeRuns.map((run) => (
              <RunningWaveCard
                key={run.id}
                wave={{ wave_number: 0, status: "running", steps_total: 0, steps_completed: 0, steps_failed: 0 }}
                run={run}
                slug={slug}
                onStop={() => handleStop(run.id)}
                stopping={stoppingIds.has(run.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Regular queue — collapsible */}
      {hasQueued && (
        <CollapsibleSection
          title="Fila"
          icon={<Clock className="w-4 h-4" />}
          count={regularQueue.length}
          defaultOpen={true}
          accentClass="text-amber-700 dark:text-amber-400"
        >
          <div className="flex flex-col gap-2">
            {regularQueue.map((item, idx) => (
              <QueuedWaveCard
                key={item.id}
                item={item}
                index={idx + 1}
                onRemove={() => handleRemoveFromQueue(item.id)}
                removing={removingIds.has(item.id)}
                onMoveUp={() => handleReorder(item.id, "up")}
                onMoveDown={() => handleReorder(item.id, "down")}
                isFirst={idx === 0}
                isLast={idx === regularQueue.length - 1}
              />
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Dependency-queued */}
      {hasDeps && (
        <CollapsibleSection
          title="Aguardando dependência"
          icon={<Link2 className="w-4 h-4" />}
          count={depQueue.length}
          defaultOpen={true}
          accentClass="text-purple-700 dark:text-purple-400"
        >
          <div className="flex flex-col gap-2">
            {depQueue.map((item) => (
              <div key={item.id} className="flex flex-col gap-1">
                <QueuedWaveCard
                  item={item}
                  onRemove={() => handleRemoveFromQueue(item.id)}
                  removing={removingIds.has(item.id)}
                />
                {item.dependsOn && (
                  <div className="ml-9">
                    <DependencyLabel dep={item.dependsOn} depRunInfo={depRunInfo} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  RefreshCcw,
  ChevronRight,
  AlertTriangle,
  Clock,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { FeatureLoopDashboard } from "@/components/wave/feature-loop-dashboard"

type StepStatus = "pending" | "running" | "completed" | "failed" | "interrupted"

interface Step {
  index: number
  task: string
  type: "spawn-agent" | "ralph-wiggum-loop"
  status: StepStatus
  started_at?: string
  finished_at?: string
  duration_ms?: number
  exit_code?: number
}

interface WaveTiming {
  started_at: string
  elapsed_ms: number
  completed_steps_avg_ms: number
  completed_steps_total_ms: number
  remaining_steps: number
  estimated_remaining_ms: number
  estimated_completion: string
}

interface WaveDetail {
  wave_number: number
  status: StepStatus
  steps_total: number
  steps_completed: number
  steps_failed: number
  progress: number
  steps: Step[]
  timing: WaveTiming | null
}

function formatDuration(ms?: number): string {
  if (ms == null) return ""
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatHHMM(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function TimingSection({ timing, steps, now }: { timing: WaveTiming | null; steps: Step[]; now: number }) {
  // When timing is null (no completed steps), compute elapsed from first started step
  const firstStarted = steps.find((s) => s.started_at)
  const elapsedMs = timing
    ? timing.elapsed_ms
    : firstStarted?.started_at
      ? now - new Date(firstStarted.started_at).getTime()
      : null

  if (elapsedMs == null) return null

  const hasCompleted = timing != null

  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-x-6 gap-y-2 rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 shrink-0">
        <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-muted-foreground text-xs">Decorrido</span>
        <span className="font-medium tabular-nums">{formatDuration(elapsedMs)}</span>
      </div>

      {hasCompleted && timing && (
        <>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-muted-foreground text-xs">Média/step</span>
            <span className="font-medium tabular-nums">{formatDuration(timing.completed_steps_avg_ms)}</span>
          </div>

          {timing.remaining_steps > 0 && (
            <div className="flex items-center gap-2 shrink-0 opacity-60">
              <span className="text-muted-foreground text-xs">Restante</span>
              <span className="font-medium tabular-nums">~{formatDuration(timing.estimated_remaining_ms)}</span>
            </div>
          )}

          {timing.remaining_steps > 0 && (
            <div className="flex items-center gap-2 shrink-0 opacity-60">
              <span className="text-muted-foreground text-xs">Conclusão</span>
              <span className="font-medium tabular-nums">{formatHHMM(timing.estimated_completion)}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
  }
  if (status === "failed") {
    return <XCircle className="w-5 h-5 text-red-500 shrink-0" />
  }
  if (status === "running") {
    return <Loader2 className="w-5 h-5 text-blue-500 shrink-0 animate-spin" />
  }
  if (status === "interrupted") {
    return (
      <span title="Processo encerrado inesperadamente (PID não encontrado)">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
      </span>
    )
  }
  return <Circle className="w-5 h-5 text-muted-foreground/40 shrink-0" />
}

function TypeBadge({ type }: { type: Step["type"] }) {
  if (type === "ralph-wiggum-loop") {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-orange-500/15 text-orange-700 dark:text-orange-400">
        loop
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
      agent
    </span>
  )
}

export function WaveDetailPage() {
  const { slug, waveNumber } = useParams({
    from: "/_auth/projects/$slug/waves/$waveNumber",
  })

  const [wave, setWave] = useState<WaveDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Wave not found (${r.status})`)
        return r.json() as Promise<WaveDetail>
      })
      .then(setWave)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug, waveNumber])

  // Interval to update elapsed time for running steps every 10s
  useEffect(() => {
    const steps = wave?.steps ?? []
    const hasRunning = steps.some((s) => s.status === "running" && s.started_at)
    if (hasRunning) {
      intervalRef.current = setInterval(() => setNow(Date.now()), 10_000)
    }
    return () => {
      if (intervalRef.current != null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [wave])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-4">
        <div className="h-5 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-2 bg-muted rounded animate-pulse" />
        <div className="flex flex-col gap-3 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !wave) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm" role="alert">
          {error ?? "Wave não encontrada"}
        </p>
      </div>
    )
  }

  const steps = wave.steps ?? []

  return (
    <div className="flex flex-col p-6 gap-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold mb-1">Wave {wave.wave_number}</h1>
        <p className="text-xs text-muted-foreground">
          {wave.steps_completed}/{wave.steps_total} steps concluídos
          {wave.steps_failed > 0 && (
            <span className="text-red-500 ml-2">· {wave.steps_failed} falhou</span>
          )}
        </p>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>Progresso</span>
          <span>{wave.progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${wave.progress}%` }}
          />
        </div>
      </div>

      {/* Timing section */}
      <TimingSection timing={wave.timing} steps={steps} now={now} />

      {/* Timeline */}
      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum step encontrado.</p>
      ) : (
        <div className="relative flex flex-col">
          {/* Vertical line */}
          <div className="absolute left-[9px] top-6 bottom-6 w-px bg-border" />

          <div className="flex flex-col gap-0">
            {steps.map((step, idx) => (
              <Link
                key={step.index}
                to="/projects/$slug/waves/$waveNumber/steps/$stepIndex"
                params={{
                  slug,
                  waveNumber,
                  stepIndex: String(step.index),
                }}
                className={`group relative flex items-start gap-4 py-3 rounded-lg px-2 -mx-2 hover:bg-muted/50 transition-colors cursor-pointer border ${
                  step.status === "interrupted"
                    ? "bg-amber-500/10 border-amber-500/30"
                    : "border-transparent"
                }`}
              >
                {/* Status icon (sits on the vertical line) */}
                <div className="relative z-10 mt-0.5 bg-background">
                  <StatusIcon status={step.status} />
                </div>

                {/* Step info */}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-mono w-8 shrink-0">
                      {String(step.index).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-medium truncate">{step.task}</span>
                    <TypeBadge type={step.type} />
                  </div>
                  {(step.duration_ms != null || step.status === "running" || step.status === "interrupted") && (
                    <div className="flex items-center gap-1 pl-10 text-xs text-muted-foreground">
                      {step.status === "running" ? (
                        <span className="flex items-center gap-1">
                          <RefreshCcw className="w-3 h-3 animate-spin" />
                          em execução
                          {step.started_at && (
                            <span className="ml-1 tabular-nums">
                              · {formatDuration(now - new Date(step.started_at).getTime())}
                            </span>
                          )}
                        </span>
                      ) : step.status === "interrupted" ? (
                        <span className="text-amber-500">Interrompido</span>
                      ) : (
                        <span>{formatDuration(step.duration_ms)}</span>
                      )}
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground shrink-0 mt-0.5 transition-colors" />

                {/* Connector line gap for last item */}
                {idx === steps.length - 1 && <div />}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Feature Loop Dashboard — shown when the wave has a ralph-wiggum-loop step */}
      {steps.some((s) => s.type === "ralph-wiggum-loop") && (
        <div>
          <h2 className="text-base font-semibold mb-3">Feature Loop</h2>
          <FeatureLoopDashboard slug={slug} waveNumber={waveNumber} />
        </div>
      )}
    </div>
  )
}

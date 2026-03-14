import { useEffect, useState, useCallback } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"
import { useSSEContext } from "@/contexts/sse-context"
import { StatusBadge } from "@/components/ui/status-badge"
import { Square, Play } from "lucide-react"

type StepStatus = "pending" | "running" | "completed" | "failed" | "interrupted"

interface MonitorStep {
  index: number
  task: string
  type: string
  status: StepStatus
  started_at: string | null
  elapsed_ms: number | null
}

interface MonitorWave {
  number: number
  status: StepStatus
  steps: MonitorStep[]
  timing: { elapsed_ms: number; estimated_remaining_ms: number | null } | null
}

interface LoopInfo {
  status: string
  iteration: number
  total: number
  done: number
  remaining: number
  features_done: number
  feature_id: string | null
  current_feature: string | null
}

interface FeatureCounters {
  passing: number
  failing: number
  skipped: number
  pending: number
  in_progress: number
  blocked: number
}

interface Feature {
  id: string
  name: string
  status: string
  dependencies: string[]
  priority?: number
}

interface ActivityInfo {
  last_output_age_ms: number | null
  step_elapsed_ms: number | null
  engine_pid: number | null
  engine_alive: boolean
  agent_pid: number | null
  agent_alive: boolean
  run_mode: "spawn" | "detached"
  run_id: string | null
  run_active: boolean
}

interface WaveHistoryEntry {
  number: number
  status: StepStatus
  steps_total: number
  steps_done: number
  duration_ms: number | null
}

interface MonitorData {
  project: {
    name: string
    slug: string
    workflow: string
    sprint_number: number
    wave_count: number
  }
  current_wave: MonitorWave | null
  loop: LoopInfo | null
  feature_counters: FeatureCounters
  features: Feature[]
  last_output: string[]
  activity: ActivityInfo
  resumable: boolean
  wave_history: WaveHistoryEntry[]
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 40
  const cx = 52
  const cy = 52
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (percent / 100) * circumference
  return (
    <svg width="104" height="104" viewBox="0 0 104 104" className="shrink-0" aria-label={`${percent}% concluído`}>
      <circle cx={cx} cy={cy} r={radius} fill="none" className="stroke-muted" strokeWidth="8" />
      <circle
        cx={cx} cy={cy} r={radius} fill="none"
        className="stroke-primary transition-all duration-500"
        strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy + 6} textAnchor="middle" className="fill-foreground" fontSize="18" fontWeight="600">
        {percent}%
      </text>
    </svg>
  )
}

function CounterPill({ value, label, colorClass }: { value: number; label: string; colorClass: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[48px]">
      <span className={`text-xl font-bold tabular-nums leading-none ${colorClass}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground leading-none">{label}</span>
    </div>
  )
}

function featureStatusColor(status: string): string {
  switch (status) {
    case "passing": return "text-green-600 dark:text-green-400"
    case "failing": return "text-red-600 dark:text-red-400"
    case "in_progress": return "text-blue-600 dark:text-blue-400"
    case "blocked": return "text-amber-600 dark:text-amber-400"
    case "skipped": return "text-muted-foreground/50"
    default: return "text-muted-foreground"
  }
}

function stepRowClass(status: StepStatus): string {
  if (status === "running") return "bg-blue-500/5 rounded px-1 -mx-1"
  if (status === "failed") return "bg-red-500/5 rounded px-1 -mx-1"
  if (status === "interrupted") return "bg-amber-500/5 rounded px-1 -mx-1"
  return ""
}

function fmtDuration(ms: number | null | undefined): string {
  if (!ms) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  const m = Math.floor(ms / 60_000)
  const s = Math.round((ms % 60_000) / 1000)
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function fmtAge(ms: number | null): string {
  if (ms === null) return "—"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s atrás`
  const m = Math.floor(ms / 60_000)
  return `${m}m atrás`
}

export function ProjectMonitorPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/monitor" })
  const { subscribe } = useSSEContext()
  const [data, setData] = useState<MonitorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const fetchData = useCallback(() => {
    apiFetch(`/api/v1/projects/${slug}/monitor`)
      .then((r) =>
        r.ok ? (r.json() as Promise<MonitorData>) : Promise.reject(new Error("Erro ao carregar"))
      )
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [slug])

  const handleStop = useCallback(() => {
    if (!data?.activity.run_id) return
    setActionLoading(true)
    apiFetch(`/api/v1/projects/${slug}/runs/${data.activity.run_id}`, { method: "DELETE" })
      .finally(() => { setActionLoading(false); fetchData() })
  }, [data, slug, fetchData])

  const handleResume = useCallback(() => {
    if (!data?.project.workflow) return
    setActionLoading(true)
    apiFetch(`/api/v1/projects/${slug}/runs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: data.project.workflow }),
    }).finally(() => { setActionLoading(false); fetchData() })
  }, [data, slug, fetchData])

  useEffect(() => {
    fetchData()
    const unsubscribe = subscribe('monitor:snapshot', (event) => {
      const payload = event.data as { project_slug: string; data: MonitorData }
      if (payload.project_slug === slug) setData(payload.data)
    })
    return unsubscribe
  }, [slug, fetchData, subscribe])

  if (!data) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : "Carregando…"}
      </div>
    )
  }

  const isStuck =
    data.activity.last_output_age_ms !== null && data.activity.last_output_age_ms > 5 * 60_000

  return (
    <div className="flex flex-col h-full p-3 gap-3 overflow-hidden">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-shrink-0 min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h1 className="font-semibold text-sm">{data.project.name}</h1>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground font-mono truncate">
            {data.project.workflow || "—"}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">sprint {data.project.sprint_number}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{data.project.wave_count} waves</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {data.current_wave && (
            <>
              <StatusBadge status={data.current_wave.status} />
              {data.current_wave.timing && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {fmtDuration(data.current_wave.timing.elapsed_ms)}
                  {data.current_wave.timing.estimated_remaining_ms !== null && (
                    <> · ETA {fmtDuration(data.current_wave.timing.estimated_remaining_ms)}</>
                  )}
                </span>
              )}
            </>
          )}
          {data.activity.run_mode === "spawn" && data.activity.run_active && (
            <button
              onClick={handleStop}
              disabled={actionLoading}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
            >
              <Square className="w-3 h-3" />
              Parar
            </button>
          )}
          {data.activity.run_mode === "spawn" && !data.activity.engine_alive && (
            <button
              onClick={handleResume}
              disabled={actionLoading}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 disabled:opacity-50 transition-colors"
            >
              <Play className="w-3 h-3" />
              Retomar
            </button>
          )}
          {data.activity.run_mode !== "spawn" && (data.activity.engine_alive || data.resumable) && (
            <span className="text-xs text-muted-foreground italic">
              Processo externo — use a CLI para controlar
            </span>
          )}
        </div>
      </div>

      {/* 2 COLUMNS */}
      <div className="flex gap-3 flex-1 overflow-hidden min-h-0">
        {/* LEFT ~55% */}
        <div className="flex flex-col gap-3 w-[55%] overflow-hidden">
          {/* Card: Current Wave Steps */}
          <div className="bg-card border rounded-lg p-3 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Wave {data.current_wave?.number ?? "—"} — Steps
            </p>
            {!data.current_wave ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma wave ativa</p>
            ) : data.current_wave.steps.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum step</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {data.current_wave.steps.map((step) => {
                  const inner = (
                    <>
                      <span className="text-muted-foreground tabular-nums w-5 text-right flex-shrink-0">
                        {step.index}
                      </span>
                      <StatusBadge status={step.status} />
                      <span className={`font-mono truncate flex-1 ${step.status === "running" ? "text-blue-600 dark:text-blue-400" : step.status === "failed" ? "text-red-600 dark:text-red-400" : step.status === "pending" ? "text-muted-foreground/50" : ""}`}>
                        {step.task}
                      </span>
                      <span className="text-muted-foreground tabular-nums flex-shrink-0">
                        {fmtDuration(step.elapsed_ms)}
                      </span>
                    </>
                  )

                  if (step.status === "pending") {
                    return (
                      <div
                        key={step.index}
                        className={`flex items-center gap-2 text-xs ${stepRowClass(step.status)}`}
                      >
                        {inner}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={step.index}
                      to="/projects/$slug/waves/$waveNumber/steps/$stepIndex"
                      params={{ slug, waveNumber: String(data.current_wave!.number), stepIndex: String(step.index) }}
                      className={`flex items-center gap-2 text-xs hover:opacity-80 transition-opacity ${stepRowClass(step.status)}`}
                    >
                      {inner}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Card: Features List */}
          <div className="bg-card border rounded-lg p-3 flex flex-col flex-1 overflow-hidden min-h-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Lista de Features ({data.features.length})
            </p>
            <div className="overflow-y-auto flex-1">
              {data.features.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma feature carregada</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {data.features.map((f) => (
                    <div key={f.id} className="flex items-center gap-2 text-xs py-0.5">
                      <span className={`font-mono w-14 flex-shrink-0 tabular-nums font-medium ${featureStatusColor(f.status)}`}>
                        {f.id}
                      </span>
                      <StatusBadge status={f.status} />
                      <span className={`truncate ${f.status === "passing" ? "text-muted-foreground/60" : f.status === "skipped" ? "text-muted-foreground/40 line-through" : "text-foreground/80"}`}>
                        {f.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT flex-1 */}
        <div className="flex flex-col gap-3 flex-1 overflow-hidden min-h-0">
          {/* Card: Activity */}
          <div className="bg-card border rounded-lg p-3 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Atividade
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    data.activity.engine_alive ? "bg-green-500" : "bg-red-500"
                  }`}
                />
                <span className="text-muted-foreground">Engine</span>
                <span className="font-mono tabular-nums ml-1">
                  {data.activity.engine_pid ?? "—"}
                </span>
                <span className={`ml-1 text-[10px] font-mono px-1 py-0.5 rounded ${
                  data.activity.run_mode === "spawn"
                    ? "bg-muted text-muted-foreground"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                }`}>
                  {data.activity.run_mode ?? "detached"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                    data.activity.agent_alive
                      ? "bg-green-500"
                      : "bg-muted-foreground/30"
                  }`}
                />
                <span className="text-muted-foreground">Agente</span>
                <span className="font-mono tabular-nums ml-1">
                  {data.activity.agent_pid ?? "—"}
                </span>
              </div>
              <div className="text-muted-foreground">
                Última saída:{" "}
                <span className="text-foreground">{fmtAge(data.activity.last_output_age_ms)}</span>
              </div>
              <div className="text-muted-foreground">
                Step elapsed:{" "}
                <span className="text-foreground tabular-nums">
                  {fmtDuration(data.activity.step_elapsed_ms)}
                </span>
              </div>
            </div>
            {isStuck && (
              <div className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                ⚠ Possivelmente travado ({fmtAge(data.activity.last_output_age_ms)})
              </div>
            )}
          </div>

          {/* Card: Feature Counters */}
          {(() => {
            const fc = data.feature_counters
            const total = data.loop?.total ?? Object.values(fc).reduce((a, b) => a + b, 0)
            const passing = fc.passing
            const percent = total > 0 ? Math.round((passing / total) * 100) : 0
            const done = passing + fc.failing + fc.skipped
            const progressPercent = total > 0 ? Math.round((done / total) * 100) : 0
            return (
              <div className="bg-card border rounded-lg p-3 flex-shrink-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Features
                </p>
                <div className="flex flex-row items-center gap-4">
                  <ProgressRing percent={percent} />
                  <div className="flex flex-col gap-3 flex-1 min-w-0">
                    {data.loop && (
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Status do loop</p>
                        <p className="text-xs font-medium capitalize leading-tight">
                          {data.loop.status}
                          {data.loop.current_feature && (
                            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                              › {data.loop.current_feature}
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <CounterPill value={fc.passing} label="passing" colorClass="text-green-600 dark:text-green-400" />
                      <CounterPill value={fc.failing} label="failing" colorClass="text-red-600 dark:text-red-400" />
                      <CounterPill value={fc.in_progress} label="running" colorClass="text-blue-600 dark:text-blue-400" />
                      <CounterPill value={fc.pending} label="pending" colorClass="text-muted-foreground" />
                      {fc.skipped > 0 && <CounterPill value={fc.skipped} label="skipped" colorClass="text-yellow-600 dark:text-yellow-400" />}
                      {fc.blocked > 0 && <CounterPill value={fc.blocked} label="blocked" colorClass="text-amber-600 dark:text-amber-400" />}
                    </div>
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
              </div>
            )
          })()}

          {/* Card: Last Agent Output */}
          <div className="bg-card border rounded-lg p-3 flex-shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Última Saída do Agente
            </p>
            <div className="overflow-y-auto h-[200px]">
              {data.last_output.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Sem saída disponível</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {data.last_output.map((line, i) => (
                    <p
                      key={i}
                      className={`text-xs font-mono break-words leading-relaxed ${
                        line.startsWith("→ tool:")
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-foreground/80"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card: Wave History */}
          <div className="bg-card border rounded-lg p-3 flex flex-col flex-1 overflow-hidden min-h-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Histórico de Waves
            </p>
            <div className="overflow-y-auto flex-1">
              {data.wave_history.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma wave</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-normal pb-1 pr-2">Wave</th>
                      <th className="text-left font-normal pb-1 pr-2">Status</th>
                      <th className="text-right font-normal pb-1 pr-2">Steps</th>
                      <th className="text-right font-normal pb-1">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.wave_history.map((w) => (
                      <tr key={w.number} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-0.5 pr-2 tabular-nums">
                          <Link
                            to="/projects/$slug/waves/$waveNumber"
                            params={{ slug, waveNumber: String(w.number) }}
                            className="text-foreground hover:underline"
                          >
                            #{w.number}
                          </Link>
                        </td>
                        <td className="py-0.5 pr-2">
                          <Link to="/projects/$slug/waves/$waveNumber" params={{ slug, waveNumber: String(w.number) }}>
                            <StatusBadge status={w.status} />
                          </Link>
                        </td>
                        <td className="py-0.5 pr-2 text-right tabular-nums text-muted-foreground">
                          {w.steps_done}/{w.steps_total}
                        </td>
                        <td className="py-0.5 text-right tabular-nums text-muted-foreground">
                          {fmtDuration(w.duration_ms)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

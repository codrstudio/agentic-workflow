import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { ShieldCheck, OctagonX, ChevronDown, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useSSEContext } from "@/contexts/sse-context"

interface CrashSummary {
  wave: number
  file: string
  timestamp: string
  handler: string
  pid: number
  uptime: string
  errorMessage: string
  memory: { rss: string; heapUsed: string; heapTotal: string }
  hasWorkflowState: boolean
  engineLogLines: number
  task?: string
  agent?: string
  inactivity?: string
}

interface CrashDetail extends CrashSummary {
  nodeVersion: string
  platform: string
  argv: string
  errorStack: string
  workflowState: unknown
  engineLogTail: string[]
}

type ActiveTab = "error" | "workflow" | "log"

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

function HandlerBadge({ handler }: { handler: string }) {
  if (handler === "agent-stagnation") {
    return (
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
        Agent Stagnation
      </span>
    )
  }
  const label = handler === "unhandledRejection" ? "Unhandled Rejection" : "Uncaught Exception"
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
      {label}
    </span>
  )
}

function CrashCardDetail({ slug, wave, file }: { slug: string; wave: number; file: string }) {
  const [detail, setDetail] = useState<CrashDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ActiveTab>("error")

  useEffect(() => {
    const params = file !== "crash-report.log" ? `?file=${encodeURIComponent(file)}` : ""
    apiFetch(`/api/v1/projects/${slug}/crashes/${wave}${params}`)
      .then((r) => r.json() as Promise<CrashDetail>)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [slug, wave, file])

  if (loading) {
    return <div className="h-32 animate-pulse bg-muted rounded" />
  }

  if (!detail) {
    return <p className="text-sm text-muted-foreground">Falha ao carregar detalhes.</p>
  }

  return (
    <div className="mt-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-3">
        {(["error", "workflow", "log"] as ActiveTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t transition-colors ${
              tab === t
                ? "bg-background border border-b-background border-border -mb-px text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "error" && "Erro"}
            {t === "workflow" && "Workflow"}
            {t === "log" && `Engine Log (${detail.engineLogLines})`}
          </button>
        ))}
      </div>

      {tab === "error" && (
        <pre className="font-mono text-xs bg-red-950/20 border border-red-500/20 p-4 rounded overflow-auto max-h-64 whitespace-pre-wrap">
          {detail.errorStack.split("\n").map((line, i) => (
            <span key={i} className={i === 0 ? "text-red-500 font-bold" : "text-muted-foreground"}>
              {line}
              {"\n"}
            </span>
          ))}
        </pre>
      )}

      {tab === "workflow" && (
        <div>
          {detail.hasWorkflowState ? (
            <pre className="font-mono text-xs bg-muted p-4 rounded overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(detail.workflowState, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              workflow-state.json indisponível no momento do crash.
            </p>
          )}
        </div>
      )}

      {tab === "log" && (
        <div className="overflow-auto max-h-64 bg-muted rounded p-3 space-y-0.5">
          {detail.engineLogTail.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Sem linhas de log.</p>
          ) : (
            detail.engineLogTail.map((line, i) => {
              let parsed: Record<string, unknown> | null = null
              try {
                parsed = JSON.parse(line) as Record<string, unknown>
              } catch {
                // raw line
              }
              return (
                <div key={i} className="font-mono text-xs text-muted-foreground truncate">
                  {parsed
                    ? `[${String(parsed["timestamp"] ?? "")}] ${String(parsed["type"] ?? "")} ${String(parsed["message"] ?? "")}`
                    : line}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

function CrashCard({ crash, slug }: { crash: CrashSummary; slug: string }) {
  const [expanded, setExpanded] = useState(false)
  const isStagnation = crash.handler === "agent-stagnation"

  return (
    <div className={`bg-card border rounded-lg px-4 py-3 ${isStagnation ? "border-amber-500/30" : "border-border"}`}>
      <div className="flex items-start gap-3">
        <OctagonX className={`w-4 h-4 mt-0.5 shrink-0 ${isStagnation ? "text-amber-500" : "text-red-500"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Link
              to="/projects/$slug/waves/$waveNumber"
              params={{ slug, waveNumber: String(crash.wave) }}
              className="text-xs font-mono font-semibold text-blue-500 hover:underline shrink-0"
            >
              Wave {crash.wave}
            </Link>
            <HandlerBadge handler={crash.handler} />
            {crash.task && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {crash.task}
              </span>
            )}
            <span
              className="text-xs text-muted-foreground"
              title={new Date(crash.timestamp).toLocaleString()}
            >
              {formatRelative(crash.timestamp)}
            </span>
            {crash.inactivity && (
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                inativo {crash.inactivity}
              </span>
            )}
            {!crash.inactivity && (
              <span className="text-xs text-muted-foreground ml-auto shrink-0">
                uptime {crash.uptime}
              </span>
            )}
          </div>

          <p className={`text-xs font-mono truncate mb-2 ${isStagnation ? "text-amber-500" : "text-red-500"}`}>
            {crash.errorMessage || "Erro desconhecido"}
          </p>

          <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="bg-muted px-1.5 py-0.5 rounded">RSS {crash.memory.rss}</span>
            <span className="bg-muted px-1.5 py-0.5 rounded">
              Heap {crash.memory.heapUsed}/{crash.memory.heapTotal}
            </span>
            <span className="bg-muted px-1.5 py-0.5 rounded">PID {crash.pid}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 p-1 hover:bg-muted rounded transition-colors"
          aria-label={expanded ? "Recolher" : "Ver detalhes"}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
      </div>

      {expanded && <CrashCardDetail slug={slug} wave={crash.wave} file={crash.file} />}
    </div>
  )
}

export function ProjectCrashesPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/crashes" })

  const [crashes, setCrashes] = useState<CrashSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [newCrash, setNewCrash] = useState(false)
  const { subscribe } = useSSEContext()

  useEffect(() => {
    apiFetch(`/api/v1/projects/${slug}/crashes`)
      .then((r) => r.json() as Promise<CrashSummary[]>)
      .then(setCrashes)
      .catch(() => setCrashes([]))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    return subscribe("run:crash", (event) => {
      const data = event.data as { slug?: string; retryCount?: number }
      if (data.slug !== slug) return
      setNewCrash(true)
      // Refresh crash list
      apiFetch(`/api/v1/projects/${slug}/crashes`)
        .then((r) => r.json() as Promise<CrashSummary[]>)
        .then((list) => {
          setCrashes(list)
          setNewCrash(false)
        })
        .catch(() => setNewCrash(false))
    })
  }, [slug, subscribe])

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        <div className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col gap-3">
          <div className="h-6 bg-muted rounded w-48 animate-pulse" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
      <div className="col-span-1 md:col-span-2 xl:col-span-3 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold">Crashes & Incidents</h1>
          {crashes.length > 0 && (
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
              {crashes.length}
            </span>
          )}
          {newCrash && (
            <span className="flex items-center gap-1.5 text-xs text-red-500">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              Novo crash detectado
            </span>
          )}
        </div>

        {/* Empty state */}
        {crashes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <ShieldCheck className="w-10 h-10" />
            <p className="text-sm font-medium">Nenhum incidente registrado</p>
            <p className="text-xs text-center max-w-xs">
              Crashes e stagnations de agentes aparecerão aqui.
            </p>
          </div>
        )}

        {/* Crash list */}
        {crashes.map((crash) => (
          <CrashCard key={`${crash.wave}-${crash.file}`} crash={crash} slug={slug} />
        ))}
      </div>
    </div>
  )
}

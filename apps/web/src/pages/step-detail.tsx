import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "@tanstack/react-router"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowDown,
  Search,
  Clock,
  Brain,
  MessageSquare,
  Wrench,
  AlertTriangle,
  DollarSign,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { fmtDuration, fmtTokens } from "@/lib/format"
import { type LogLine, type LogLineType, type ParsedLine, type ContentBlock, parseAllLines } from "@/lib/jsonl"

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttemptMeta {
  dir: string
  feature?: string
  attempt: number
  task?: string
  agent?: string
  pid?: number
  started_at?: string
  finished_at?: string
  exit_code?: number
  timed_out?: boolean
  model_used?: string
  status: "pending" | "running" | "completed" | "failed" | "interrupted"
  duration_ms?: number
}

interface StepMeta {
  index: number
  dir: string
  task?: string
  agent?: string
  started_at?: string
  finished_at?: string
  exit_code?: number
  timed_out?: boolean
  model_used?: string
  status: "pending" | "running" | "completed" | "failed"
  duration_ms?: number
  type?: string
  iteration?: number
  total?: number
  done?: number
  remaining?: number
  features_done?: number
  exit_reason?: string
  attempts?: AttemptMeta[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  const date = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
  const time = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  return `${date} ${time}`
}

const TYPE_FILTERS: { type: LogLineType; label: string; activeClass: string }[] = [
  { type: "assistant", label: "assistant", activeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-400/40" },
  { type: "tool_use", label: "tool_use", activeClass: "bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-400/40" },
  { type: "tool_result", label: "tool_result", activeClass: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-400/40" },
  { type: "system", label: "system", activeClass: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-400/40" },
  { type: "user", label: "user", activeClass: "bg-green-500/15 text-green-600 dark:text-green-400 border-green-400/40" },
]

// ─── ContentBlockView (monitor-style rendering) ─────────────────────────────

function ContentBlockView({ block }: { block: ContentBlock }) {
  switch (block.kind) {
    case "thinking":
      return (
        <div className="flex gap-1.5 items-start text-xs">
          <Brain className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
          <span className="text-purple-400/70 italic line-clamp-2">{block.text}</span>
        </div>
      )
    case "text":
      return (
        <div className="flex gap-1.5 items-start text-xs">
          <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span className="text-foreground/80 line-clamp-3 break-words">{block.text}</span>
        </div>
      )
    case "tool_call":
      return (
        <div className="flex gap-1.5 items-start text-xs">
          <Wrench className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="font-semibold text-amber-500">{block.name}</span>
            {block.summary && (
              <span className="ml-1.5 text-muted-foreground font-mono truncate block">{block.summary}</span>
            )}
          </div>
        </div>
      )
    case "tool_result":
      return (
        <div className="flex gap-1.5 items-start text-xs pl-5">
          {block.success ? (
            <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-3 h-3 text-red-500 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <span className={`text-[10px] font-mono ${block.success ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {block.name} {block.success ? "ok" : "erro"}
            </span>
            {block.snippet && (
              <p className="text-muted-foreground font-mono text-[10px] line-clamp-2 break-all mt-0.5">{block.snippet}</p>
            )}
          </div>
        </div>
      )
    case "result":
      return (
        <div className={`rounded border p-2 text-xs ${block.is_error ? "border-red-500/30 bg-red-500/5" : "border-green-500/30 bg-green-500/5"}`}>
          <div className="flex items-center gap-2 mb-1.5">
            {block.is_error ? (
              <XCircle className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            )}
            <span className={`font-semibold ${block.is_error ? "text-red-500" : "text-green-500"}`}>
              {block.is_error ? "Falhou" : "Concluído"}
            </span>
            <span className="text-muted-foreground">{fmtDuration(block.duration_ms)}</span>
            <span className="text-muted-foreground">{block.num_turns} turns</span>
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
            <span><DollarSign className="w-2.5 h-2.5 inline" /> ${block.cost_usd.toFixed(2)}</span>
            <span>in {fmtTokens(block.input_tokens)}</span>
            <span>out {fmtTokens(block.output_tokens)}</span>
            {block.cache_read_tokens > 0 && <span className="col-span-3">cache {fmtTokens(block.cache_read_tokens)}</span>}
          </div>
          {block.result_text && (
            <p className="mt-1.5 text-foreground/70 line-clamp-3 break-words">{block.result_text}</p>
          )}
        </div>
      )
    case "rate_limit": {
      const pct = Math.round(block.utilization * 100)
      const isWarning = block.status === "allowed_warning" || block.status === "denied"
      return (
        <div className={`flex items-center gap-2 text-xs rounded px-2 py-1 ${isWarning ? "bg-amber-500/10" : "bg-muted/50"}`}>
          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isWarning ? "text-amber-500" : "text-muted-foreground"}`} />
          <div className="flex-1 min-w-0 max-w-[120px]">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-green-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <span className={`text-[10px] font-mono tabular-nums ${isWarning ? "text-amber-500" : "text-muted-foreground"}`}>
            {pct}%
          </span>
        </div>
      )
    }
    case "raw":
      return (
        <div className="text-xs text-muted-foreground font-mono truncate">{block.text}</div>
      )
  }
}

// ─── FeedItem (one parsed line → rendered as flowing entry) ─────────────────

function FeedItem({ line }: { line: ParsedLine }) {
  return (
    <div className="flex flex-col gap-1">
      {line.blocks.map((block, i) => (
        <ContentBlockView key={i} block={block} />
      ))}
    </div>
  )
}

// ─── LogFeed (replaces LogViewer — flowing feed, not data table) ────────────

function LogFeed({ parsedLines }: { parsedLines: ParsedLine[] }) {
  const feedRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const handleScroll = useCallback(() => {
    const el = feedRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distFromBottom > 200)
  }, [])

  const scrollToBottom = useCallback(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" })
  }, [])

  return (
    <div className="relative">
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="overflow-y-auto max-h-[600px] flex flex-col gap-1.5 py-2 px-3"
      >
        {parsedLines.map((line) => (
          <FeedItem key={line.index} line={line} />
        ))}
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        >
          <ArrowDown className="w-3 h-3" />
          Ir para o fim
        </button>
      )}
    </div>
  )
}

// ─── AttemptLogPanel ──────────────────────────────────────────────────────────

function AttemptLogPanel({
  slug,
  waveNumber,
  stepIndex,
  attempt,
}: {
  slug: string
  waveNumber: string
  stepIndex: string
  attempt: AttemptMeta
}) {
  const [allLines, setAllLines] = useState<LogLine[]>([])
  const [search, setSearch] = useState("")
  const [hiddenTypes, setHiddenTypes] = useState<Set<LogLineType>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    async function load() {
      const BATCH = 500
      let offset = 0
      const collected: LogLine[] = []
      while (true) {
        const logRes = await apiFetch(
          `/api/v1/projects/${slug}/waves/${waveNumber}/steps/${stepIndex}/log?attempt=${encodeURIComponent(attempt.dir)}&offset=${offset}&limit=${BATCH}`
        )
        if (!logRes.ok) break
        const data = await logRes.json() as { total: number; offset: number; limit: number; lines: LogLine[] }
        if (cancelled) return
        collected.push(...data.lines)
        if (offset + BATCH >= data.total) break
        offset += BATCH
      }
      if (!cancelled) {
        setAllLines(collected)
        setLoading(false)
      }
    }

    load().catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug, waveNumber, stepIndex, attempt.dir])

  const parsedLines = useMemo(() => parseAllLines(allLines), [allLines])

  const filteredLines = useMemo(() => {
    let lines = parsedLines
    if (hiddenTypes.size > 0) {
      lines = lines.filter((line) => !hiddenTypes.has(line.type))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      lines = lines.filter((line) => line.searchText.includes(q))
    }
    return lines
  }, [parsedLines, search, hiddenTypes])

  const toggleType = (type: LogLineType) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  if (loading) {
    return <div className="h-32 bg-muted rounded animate-pulse m-2" />
  }

  return (
    <div className="flex flex-col gap-2 p-3 border-t border-border bg-muted/30">
      <div className="flex items-center gap-3 justify-between flex-wrap">
        <span className="text-xs text-muted-foreground">
          {search.trim() || hiddenTypes.size > 0
            ? `${filteredLines.length} / ${allLines.length} linhas`
            : `${allLines.length} linhas`}
        </span>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="search"
            placeholder="Filtrar linhas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TYPE_FILTERS.map(({ type, label, activeClass }) => {
          const isActive = !hiddenTypes.has(type)
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                isActive
                  ? activeClass
                  : "bg-muted/30 text-muted-foreground/40 border-border line-through"
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
      {filteredLines.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {allLines.length === 0 ? "Log ainda não disponível." : "Nenhuma linha encontrada."}
        </p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <LogFeed parsedLines={filteredLines} />
        </div>
      )}
    </div>
  )
}

// ─── StepDetailPage ───────────────────────────────────────────────────────────

export function StepDetailPage() {
  const { slug, waveNumber, stepIndex } = useParams({
    from: "/_auth/projects/$slug/waves/$waveNumber/steps/$stepIndex",
  })

  const [meta, setMeta] = useState<StepMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      const metaRes = await apiFetch(
        `/api/v1/projects/${slug}/waves/${waveNumber}/steps/${stepIndex}`
      )
      if (!metaRes.ok) throw new Error(`Step não encontrado (${metaRes.status})`)
      const metaData = await metaRes.json() as StepMeta
      if (cancelled) return
      setMeta(metaData)

      if (metaData.attempts?.length === 1 && metaData.attempts[0]) {
        setExpandedAttempt(metaData.attempts[0].dir)
      }
    }

    load()
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [slug, waveNumber, stepIndex])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-4">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-24 bg-muted rounded animate-pulse" />
        <div className="h-[600px] bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (error || !meta) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm" role="alert">
          {error ?? "Step não encontrado"}
        </p>
      </div>
    )
  }

  const isSuccess = meta.exit_code === 0
  const isRunning = meta.status === "running"
  const isLoop = meta.type === "ralph-wiggum-loop"
  const hasAttempts = (meta.attempts?.length ?? 0) > 0

  return (
    <div className="flex flex-col p-6 gap-5 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-start gap-3 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            {isRunning ? (
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin shrink-0" />
            ) : isSuccess ? (
              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500 shrink-0" />
            )}
            <h1 className="text-base font-semibold truncate">
              Step {String(meta.index).padStart(2, "0")} — {meta.task ?? "unknown"}
            </h1>
          </div>

          {!isRunning && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold shrink-0 ${
                isSuccess
                  ? "bg-green-500/15 text-green-700 dark:text-green-400"
                  : "bg-red-500/15 text-red-700 dark:text-red-400"
              }`}
            >
              {isSuccess ? "success" : `exit ${meta.exit_code}`}
            </span>
          )}
          {isRunning && (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-400 shrink-0">
              running
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Task</p>
            <p className="font-mono font-medium truncate">{meta.task ?? "—"}</p>
          </div>
          {!isLoop && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-muted-foreground mb-0.5">Agent</p>
              <p className="font-mono font-medium">{meta.agent ?? "—"}</p>
            </div>
          )}
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-muted-foreground mb-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Início
            </p>
            <p className="font-mono">{formatTime(meta.started_at)}</p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-muted-foreground mb-0.5 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Duração
            </p>
            <p className="font-mono">{meta.duration_ms != null ? fmtDuration(meta.duration_ms) : isRunning ? "em execução" : "—"}</p>
          </div>
          {isLoop && (
            <>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground mb-0.5">Features</p>
                <p className="font-mono font-medium">{meta.done ?? 0} / {meta.total ?? 0}</p>
              </div>
              <div className="rounded-md bg-muted/50 px-3 py-2">
                <p className="text-muted-foreground mb-0.5">Iterações</p>
                <p className="font-mono font-medium">{meta.iteration ?? 0}</p>
              </div>
            </>
          )}
          {meta.model_used && (
            <div className="col-span-2 rounded-md bg-muted/50 px-3 py-2">
              <p className="text-muted-foreground mb-0.5">Modelo</p>
              <p className="font-mono">{meta.model_used}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Attempts ────────────────────────────────────────────────────── */}
      {hasAttempts && meta.attempts && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            {isLoop ? `Feature Attempts (${meta.attempts.length})` : `Attempts (${meta.attempts.length})`}
          </h2>
          <div className="rounded-lg border border-border overflow-hidden divide-y divide-border">
            {meta.attempts.map((a) => {
              const aSuccess = a.exit_code === 0
              const aRunning = a.status === "running"
              const isExpanded = expandedAttempt === a.dir
              return (
                <div key={a.dir}>
                  <button
                    onClick={() => setExpandedAttempt(isExpanded ? null : a.dir)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    {aRunning ? (
                      <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                    ) : aSuccess ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                    )}
                    {isLoop && a.feature ? (
                      <>
                        <span className="font-mono text-sm font-medium min-w-[4rem]">{a.feature}</span>
                        <span className="text-xs text-muted-foreground">attempt {a.attempt}</span>
                      </>
                    ) : (
                      <span className="font-mono text-sm font-medium">Attempt {a.attempt}</span>
                    )}
                    {a.agent && <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">{a.agent}</span>}
                    {a.duration_ms != null && (
                      <span className="text-xs text-muted-foreground ml-2">{fmtDuration(a.duration_ms)}</span>
                    )}
                    <span className="text-xs text-muted-foreground">{isExpanded ? "▲" : "▼"}</span>
                  </button>
                  {isExpanded && (
                    <AttemptLogPanel
                      slug={slug}
                      waveNumber={waveNumber}
                      stepIndex={stepIndex}
                      attempt={a}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!hasAttempts && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground py-8 text-center">
            {isRunning ? "Aguardando início do agente..." : "Nenhum attempt disponível."}
          </p>
        </div>
      )}
    </div>
  )
}

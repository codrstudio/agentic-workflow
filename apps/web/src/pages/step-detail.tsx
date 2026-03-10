import { useEffect, useRef, useState, useCallback } from "react"
import { useParams } from "@tanstack/react-router"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowDown,
  Search,
  Clock,
  User,
  Bot,
  Wrench,
  Terminal,
  AlertCircle,
} from "lucide-react"
import { List, useListRef } from "react-window"
import { apiFetch } from "@/lib/api"

// ─── Types ───────────────────────────────────────────────────────────────────

type LogLineType = "system" | "assistant" | "tool_use" | "tool_result" | "user"

interface LogLine {
  index: number
  type: LogLineType
  raw: unknown
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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms?: number): string {
  if (ms == null) return ""
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`
}

function formatTime(iso?: string): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

/** Extract a human-readable summary from a raw log line. */
function extractText(line: LogLine): string {
  const raw = line.raw as Record<string, unknown>

  if (line.type === "system") {
    // system lines usually have { type: "system", subtype: "init", ... }
    const subtype = raw["subtype"] as string | undefined
    if (subtype === "init") return "[system init]"
    return JSON.stringify(raw).slice(0, 200)
  }

  if (line.type === "assistant" || line.type === "tool_use") {
    const msg = raw["message"] as Record<string, unknown> | undefined
    const content = Array.isArray(msg?.["content"])
      ? (msg!["content"] as Array<Record<string, unknown>>)
      : []
    const parts: string[] = []
    for (const c of content) {
      if (c["type"] === "text") {
        parts.push((c["text"] as string) ?? "")
      } else if (c["type"] === "tool_use") {
        const input = c["input"] ? JSON.stringify(c["input"]).slice(0, 120) : ""
        parts.push(`[tool: ${c["name"] ?? "unknown"}] ${input}`)
      }
    }
    return parts.join(" ").trim() || JSON.stringify(raw).slice(0, 200)
  }

  if (line.type === "tool_result" || line.type === "user") {
    const msg = raw["message"] as Record<string, unknown> | undefined
    const content = Array.isArray(msg?.["content"])
      ? (msg!["content"] as Array<Record<string, unknown>>)
      : []
    const parts: string[] = []
    for (const c of content) {
      if (c["type"] === "tool_result") {
        const inner = Array.isArray(c["content"]) ? (c["content"] as Array<Record<string, unknown>>) : []
        for (const ic of inner) {
          if (ic["type"] === "text") parts.push((ic["text"] as string) ?? "")
        }
        if (!parts.length && typeof c["content"] === "string") {
          parts.push(c["content"] as string)
        }
      } else if (c["type"] === "text") {
        parts.push((c["text"] as string) ?? "")
      }
    }
    return parts.join(" ").trim() || JSON.stringify(raw).slice(0, 200)
  }

  return JSON.stringify(raw).slice(0, 200)
}

// ─── Color / Icon config by type ─────────────────────────────────────────────

const TYPE_CONFIG: Record<
  LogLineType,
  { label: string; textClass: string; borderClass: string; bgClass: string; Icon: React.FC<{ className?: string }> }
> = {
  assistant: {
    label: "assistant",
    textClass: "text-blue-600 dark:text-blue-400",
    borderClass: "border-blue-400/40",
    bgClass: "bg-blue-500/5",
    Icon: ({ className }) => <Bot className={className} />,
  },
  tool_use: {
    label: "tool_use",
    textClass: "text-purple-600 dark:text-purple-400",
    borderClass: "border-purple-400/40",
    bgClass: "bg-purple-500/5",
    Icon: ({ className }) => <Wrench className={className} />,
  },
  tool_result: {
    label: "tool_result",
    textClass: "text-slate-500 dark:text-slate-400",
    borderClass: "border-slate-400/30",
    bgClass: "bg-slate-500/5",
    Icon: ({ className }) => <Terminal className={className} />,
  },
  system: {
    label: "system",
    textClass: "text-yellow-600 dark:text-yellow-400",
    borderClass: "border-yellow-400/40",
    bgClass: "bg-yellow-500/5",
    Icon: ({ className }) => <AlertCircle className={className} />,
  },
  user: {
    label: "user",
    textClass: "text-green-600 dark:text-green-400",
    borderClass: "border-green-400/40",
    bgClass: "bg-green-500/5",
    Icon: ({ className }) => <User className={className} />,
  },
}

// ─── LogRow (rendered by react-window v2 List) ───────────────────────────────

const ROW_HEIGHT = 56

interface RowProps {
  index: number
  style: React.CSSProperties
  ariaAttributes: Record<string, unknown>
  lines: LogLine[]
}

function LogRow({ index, style, lines }: RowProps) {
  const line = lines[index]
  if (!line) return null
  const cfg = TYPE_CONFIG[line.type]
  const text = extractText(line)
  return (
    <div
      style={style}
      className={`flex items-start gap-2 px-3 py-2 border-l-2 ${cfg.borderClass} ${cfg.bgClass} border-b border-border/30`}
    >
      <cfg.Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cfg.textClass}`} />
      <div className="flex items-start gap-2 min-w-0 flex-1 overflow-hidden">
        <span className={`text-[10px] font-mono shrink-0 mt-0.5 w-16 ${cfg.textClass}`}>
          [{String(line.index).padStart(4, "0")}]
        </span>
        <span className={`text-[10px] font-mono shrink-0 mt-0.5 w-14 ${cfg.textClass}`}>
          {cfg.label}
        </span>
        <span className="text-xs text-foreground font-mono leading-tight whitespace-pre-wrap break-words min-w-0 line-clamp-2">
          {text}
        </span>
      </div>
    </div>
  )
}

// ─── LogViewer ───────────────────────────────────────────────────────────────

function LogViewer({ lines }: { lines: LogLine[] }) {
  const listRef = useListRef()
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const el = listRef.current?.element
    if (!el) return
    const handleScroll = () => {
      const totalHeight = lines.length * ROW_HEIGHT
      const distFromBottom = totalHeight - el.scrollTop - el.clientHeight
      setShowScrollBtn(distFromBottom > 200)
    }
    el.addEventListener("scroll", handleScroll)
    return () => el.removeEventListener("scroll", handleScroll)
  }, [lines.length, listRef])

  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToRow({ index: lines.length - 1, align: "end" })
  }, [lines.length, listRef])

  return (
    <div className="relative">
      <List
        listRef={listRef}
        rowComponent={LogRow}
        rowCount={lines.length}
        rowHeight={ROW_HEIGHT}
        rowProps={{ lines }}
        style={{ height: 600, fontFamily: "monospace" }}
      />

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

// ─── StepDetailPage ───────────────────────────────────────────────────────────

export function StepDetailPage() {
  const { slug, waveNumber, stepIndex } = useParams({
    from: "/_auth/projects/$slug/waves/$waveNumber/steps/$stepIndex",
  })

  const [meta, setMeta] = useState<StepMeta | null>(null)
  const [allLines, setAllLines] = useState<LogLine[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch step metadata + all log lines
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      // Load metadata
      const metaRes = await apiFetch(
        `/api/v1/projects/${slug}/waves/${waveNumber}/steps/${stepIndex}`
      )
      if (!metaRes.ok) throw new Error(`Step não encontrado (${metaRes.status})`)
      const metaData = await metaRes.json() as StepMeta
      if (cancelled) return
      setMeta(metaData)

      // Load all log lines in batches
      const BATCH = 500
      let offset = 0
      const collected: LogLine[] = []
      while (true) {
        const logRes = await apiFetch(
          `/api/v1/projects/${slug}/waves/${waveNumber}/steps/${stepIndex}/log?offset=${offset}&limit=${BATCH}`
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
      }
    }

    load()
      .catch((e: Error) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [slug, waveNumber, stepIndex])

  // Client-side search filter
  const filteredLines = search.trim()
    ? allLines.filter((line) => {
        const text = extractText(line).toLowerCase()
        return text.includes(search.toLowerCase())
      })
    : allLines

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

  return (
    <div className="flex flex-col p-6 gap-5 max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3">
        {/* Title row */}
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

          {/* Success/failure badge */}
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

        {/* Meta grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Task</p>
            <p className="font-mono font-medium truncate">{meta.task ?? "—"}</p>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-muted-foreground mb-0.5">Agent</p>
            <p className="font-mono font-medium">{meta.agent ?? "—"}</p>
          </div>
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
            <p className="font-mono">{meta.duration_ms != null ? formatDuration(meta.duration_ms) : isRunning ? "em execução" : "—"}</p>
          </div>
          {meta.model_used && (
            <div className="col-span-2 rounded-md bg-muted/50 px-3 py-2">
              <p className="text-muted-foreground mb-0.5">Modelo</p>
              <p className="font-mono">{meta.model_used}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Log section ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3">
        {/* Toolbar */}
        <div className="flex items-center gap-3 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Log</h2>
            <span className="text-xs text-muted-foreground">
              {search.trim()
                ? `${filteredLines.length} / ${allLines.length} linhas`
                : `${allLines.length} linhas`}
            </span>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-sm">
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

        {/* Type legend */}
        <div className="flex flex-wrap gap-2">
          {(Object.entries(TYPE_CONFIG) as [LogLineType, (typeof TYPE_CONFIG)[LogLineType]][]).map(([type, cfg]) => (
            <span key={type} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${cfg.bgClass} border ${cfg.borderClass} ${cfg.textClass}`}>
              {cfg.label}
            </span>
          ))}
        </div>

        {/* Log viewer */}
        {filteredLines.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {allLines.length === 0 ? "Log ainda não disponível." : "Nenhuma linha encontrada para o filtro."}
          </p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <LogViewer lines={filteredLines} />
          </div>
        )}
      </div>
    </div>
  )
}

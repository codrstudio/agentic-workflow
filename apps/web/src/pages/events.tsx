import { useCallback, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Pause, Play } from "lucide-react"
import { useSSEContext, type SSEEvent } from "@/contexts/sse-context"

const MAX_EVENTS = 500

type EventCategory = "workflow" | "feature" | "agent" | "loop" | "gutter" | "queue"

const CATEGORY_COLORS: Record<EventCategory, string> = {
  workflow: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  feature:  "bg-green-500/15 text-green-700 dark:text-green-400",
  agent:    "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  loop:     "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  gutter:   "bg-red-500/15 text-red-700 dark:text-red-400",
  queue:    "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
}

const ALL_EVENT_TYPES = [
  "engine:event",
  "engine:log",
  "run:started",
  "run:completed",
  "run:failed",
  "agent:action:start",
  "agent:action:end",
  "operator:message:queued",
]

function getCategory(type: string, data: unknown): EventCategory {
  if (type === "engine:event") {
    const inner = (data as { payload?: { type?: string } })?.payload?.type ?? ""
    if (inner.startsWith("workflow:")) return "workflow"
    if (inner.startsWith("feature:")) return "feature"
    if (inner.startsWith("agent:")) return "agent"
    if (inner.startsWith("loop:")) return "loop"
    if (inner.startsWith("gutter:")) return "gutter"
    if (inner.startsWith("queue:") || inner.startsWith("operator:")) return "queue"
    return "workflow"
  }
  if (type.startsWith("run:")) return "workflow"
  if (type.startsWith("agent:action:")) return "agent"
  if (type.startsWith("operator:")) return "queue"
  return "workflow"
}

function getLabel(type: string, data: unknown): string {
  if (type === "engine:event") {
    const inner = (data as { payload?: { type?: string } })?.payload?.type
    return inner ? `engine:event / ${inner}` : "engine:event"
  }
  return type
}

function getSummary(type: string, data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const d = data as Record<string, unknown>

  if (type === "engine:event") {
    const slug = d.slug as string | undefined
    const inner = (d as { payload?: { type?: string } }).payload?.type
    const parts: string[] = []
    if (slug) parts.push(slug)
    if (inner) parts.push(inner)
    return parts.join(" · ")
  }
  if (type === "run:started" || type === "run:completed" || type === "run:failed") {
    const slug = d.slug as string | undefined
    const workflow = d.workflow as string | undefined
    const pid = d.pid as number | undefined
    const parts: string[] = []
    if (slug) parts.push(slug)
    if (workflow) parts.push(workflow)
    if (pid) parts.push(`pid:${pid}`)
    return parts.join(" · ")
  }
  if (type === "agent:action:start" || type === "agent:action:end") {
    const task = d.task_name as string | undefined
    const feature = d.feature_id as string | undefined
    const agent = d.agent_profile as string | undefined
    const parts: string[] = []
    if (task) parts.push(task)
    if (feature) parts.push(feature)
    if (agent) parts.push(agent)
    return parts.join(" · ")
  }
  if (type === "operator:message:queued") {
    const msg = (d as { message?: { message?: string } }).message?.message
    return msg ? msg.slice(0, 60) + (msg.length > 60 ? "…" : "") : ""
  }
  if (type === "engine:log") {
    const line = d.line as string | undefined
    return line ? line.slice(0, 80) : ""
  }
  return ""
}

function formatRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5) return "agora"
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function formatAbsolute(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

interface FeedEvent extends SSEEvent {
  id: string
  category: EventCategory
  label: string
  summary: string
}

let _id = 0
function nextId() {
  return String(++_id)
}

export function EventsPage() {
  const { subscribe } = useSSEContext()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [paused, setPaused] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const handleEvent = useCallback((ev: SSEEvent) => {
    const feedEv: FeedEvent = {
      ...ev,
      id: nextId(),
      category: getCategory(ev.type, ev.data),
      label: getLabel(ev.type, ev.data),
      summary: getSummary(ev.type, ev.data),
    }
    setEvents((prev) => {
      const next = [feedEv, ...prev]
      return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next
    })
    if (!pausedRef.current && listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [])

  useEffect(() => {
    const unsubs = ALL_EVENT_TYPES.map((t) => subscribe(t, handleEvent))
    return () => unsubs.forEach((u) => u())
  }, [subscribe, handleEvent])

  return (
    <div className="flex flex-col h-full p-4 gap-3 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Feed de Eventos</h1>
          <p className="text-xs text-muted-foreground">
            {events.length} evento{events.length !== 1 ? "s" : ""} · máx {MAX_EVENTS}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
            {(Object.keys(CATEGORY_COLORS) as EventCategory[]).map((cat) => (
              <span
                key={cat}
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat]}`}
              >
                {cat}
              </span>
            ))}
          </div>
          <button
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? "Retomar auto-scroll" : "Pausar auto-scroll"}
            title={paused ? "Retomar auto-scroll" : "Pausar auto-scroll"}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
            {paused ? "Retomar" : "Pausar"}
          </button>
        </div>
      </div>

      {/* Event list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-1.5 min-h-0"
      >
        {events.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">
            Aguardando eventos SSE…
          </p>
        )}
        <AnimatePresence initial={false}>
          {events.map((ev) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {/* Type badge */}
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[ev.category]}`}
              >
                {ev.category}
              </span>
              {/* Label + summary */}
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs font-medium text-foreground truncate">{ev.label}</p>
                {ev.summary && (
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{ev.summary}</p>
                )}
              </div>
              {/* Timestamp */}
              <time
                dateTime={new Date(ev.timestamp).toISOString()}
                title={formatAbsolute(ev.timestamp)}
                className="shrink-0 text-xs text-muted-foreground whitespace-nowrap cursor-default"
              >
                {formatRelative(ev.timestamp)}
              </time>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}

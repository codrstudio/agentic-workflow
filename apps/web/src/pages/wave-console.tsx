import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Send, Filter, ChevronDown, ArrowDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

import { apiFetch } from "@/lib/api"
import { useSSEContext, type SSEEvent } from "@/contexts/sse-context"

const MAX_EVENTS = 500
const MAX_LINES_OPTIONS = [50, 100, 200, 500] as const
const LS_MAX_LINES_KEY = "aw-console-max-lines"
const DEFAULT_MAX_LINES = 100

type EventCategory = "queue"

const ALL_CATEGORIES: EventCategory[] = ["queue"]

const CATEGORY_COLORS: Record<EventCategory, string> = {
  queue: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
}

// Console only cares about queue events (operator interaction).
// engine:event is subscribed to detect queue:processing (pending → processed),
// but non-queue inner events are discarded before reaching the feed.
const ENGINE_EVENT_TYPES = ["engine:event"]

interface ConversationEntry {
  role: "user" | "engine"
  id?: string
  timestamp: string
  message?: string
  source?: string
  event?: string
  data?: Record<string, unknown>
  drain?: number
  pending?: boolean
}

interface EngineEventItem extends SSEEvent {
  id: string
  category: EventCategory
  label: string
  summary: string
}

type FeedItem =
  | { kind: "operator-message"; id: string; timestamp: number; entry: ConversationEntry }
  | { kind: "engine-event"; id: string; timestamp: number; ev: EngineEventItem }
  | { kind: "engine-log-entry"; id: string; timestamp: number; entry: ConversationEntry }

let _id = 0
function nextId() {
  return String(++_id)
}

function getEventCategory(_eventType: string): EventCategory {
  return "queue"
}

function getSummary(_type: string, data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const d = data as Record<string, unknown>
  const payload = d.payload as { type?: string; data?: Record<string, unknown> } | undefined
  if (!payload?.data) return ""
  const innerData = payload.data
  const count = innerData.count as number | undefined
  const exitCode = innerData.exit_code as number | undefined
  const parts: string[] = []
  if (count !== undefined) parts.push(`${count} msg`)
  if (exitCode !== undefined) parts.push(`exit=${exitCode}`)
  return parts.join(" · ")
}


function formatRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5) return "agora"
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

function getEngineEventSummary(entry: ConversationEntry): string {
  const event = entry.event ?? ""
  const data = entry.data ?? {}
  if (event === "queue:processing") {
    const count = data.count as number | undefined
    return count ? `Processando ${count} mensagen${count > 1 ? "s" : ""}…` : "Processando mensagens…"
  }
  if (event === "queue:done") {
    const exitCode = data.exit_code as number | undefined
    const timedOut = data.timed_out as boolean | undefined
    if (timedOut) return "Timeout"
    return exitCode === 0 ? "Concluído (exit: 0)" : `Falhou (exit: ${exitCode ?? "?"})`
  }
  if (event === "queue:received") {
    return `Mensagem recebida`
  }
  return event
}

export function WaveConsole({ slug, waveNumber }: { slug: string; waveNumber: string }) {
  const { subscribe } = useSSEContext()

  const [conversation, setConversation] = useState<ConversationEntry[]>([])
  const [pendingMessages, setPendingMessages] = useState<ConversationEntry[]>([])
  const [engineEvents, setEngineEvents] = useState<EngineEventItem[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [hasNewBelow, setHasNewBelow] = useState(false)
  const [enabledCategories, setEnabledCategories] = useState<Set<EventCategory>>(new Set(ALL_CATEGORIES))
  const [showOp, setShowOp] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [maxLines, setMaxLines] = useState<number>(() => {
    const stored = localStorage.getItem(LS_MAX_LINES_KEY)
    const parsed = stored ? parseInt(stored, 10) : NaN
    return MAX_LINES_OPTIONS.includes(parsed as (typeof MAX_LINES_OPTIONS)[number])
      ? parsed
      : DEFAULT_MAX_LINES
  })
  const inputRef = useRef<HTMLInputElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const slugRef = useRef(slug)
  slugRef.current = slug

  const handleCategoryToggle = (cat: EventCategory, checked: boolean) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev)
      if (checked) next.add(cat)
      else next.delete(cat)
      return next
    })
  }

  // Fetch conversation from log + queue
  useEffect(() => {
    apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}/conversation`)
      .then((r) => r.json() as Promise<ConversationEntry[]>)
      .then((entries) => {
        setConversation(entries.filter((e) => !e.pending))
        setPendingMessages(entries.filter((e) => e.pending))
      })
      .catch(() => undefined)
  }, [slug, waveNumber])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // SSE: new operator message queued
  const handleQueued = useCallback((event: SSEEvent) => {
    const payload = event.data as { slug?: string; message?: { id: string; timestamp: string; message: string; source?: string } }
    if (payload.slug !== slugRef.current || !payload.message) return
    const msg = payload.message
    setPendingMessages((prev) => {
      const exists = prev.some((m) => m.id === msg.id)
      return exists ? prev : [...prev, { role: "user", id: msg.id, timestamp: msg.timestamp, message: msg.message, source: msg.source, pending: true }]
    })
  }, [])

  useEffect(() => {
    return subscribe("operator:message:queued", handleQueued)
  }, [subscribe, handleQueued])

  // SSE: engine events — update pending status + add to live events
  const handleEngineEvent = useCallback((event: SSEEvent) => {
    const payload = event.data as { slug?: string; payload?: { type?: string; data?: Record<string, unknown> } }
    if (payload.slug === slugRef.current) {
      const innerType = payload.payload?.type
      if (innerType === "queue:processing") {
        // Move pending to conversation as consumed
        setPendingMessages((prev) => {
          if (prev.length === 0) return prev
          setConversation((conv) => [...conv, ...prev.map((m) => ({ ...m, pending: false }))])
          return []
        })
      }
    }
    // Only add queue/operator events to the feed — skip workflow/feature/agent/loop noise
    const innerType = payload.payload?.type ?? ""
    if (!innerType.startsWith("queue:") && !innerType.startsWith("operator:")) return

    const feedEv: EngineEventItem = {
      ...event,
      id: nextId(),
      category: "queue" as EventCategory,
      label: innerType,
      summary: getSummary(event.type, event.data),
    }
    setEngineEvents((prev) => {
      const next = [...prev, feedEv]
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next
    })
  }, [])

  useEffect(() => {
    return subscribe("engine:event", handleEngineEvent)
  }, [subscribe, handleEngineEvent])

  const sendMessage = async () => {
    const content = text.trim()
    if (!content || sending) return
    setSending(true)
    try {
      const res = await apiFetch(`/api/v1/projects/${slug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const msg = (await res.json()) as { id: string; timestamp: string; message: string; source?: string }
        // Add as pending (optimistic UI)
        setPendingMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id)
          return exists ? prev : [...prev, { role: "user", id: msg.id, timestamp: msg.timestamp, message: msg.message, source: msg.source, pending: true }]
        })
        setText("")
      }
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleFeedScroll = useCallback(() => {
    const el = feedRef.current
    if (!el) return
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= 50
    if (isAtBottom) {
      autoScrollRef.current = true
      setHasNewBelow(false)
    } else {
      autoScrollRef.current = false
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true
    setHasNewBelow(false)
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" })
  }, [])

  // Build feed from conversation + pending + live engine events
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []
    const q = searchQuery.toLowerCase()

    // Conversation entries from log
    for (const entry of conversation) {
      if (entry.role === "user") {
        if (!showOp) continue
        if (q && !(entry.message ?? "").toLowerCase().includes(q)) continue
        items.push({
          kind: "operator-message",
          id: `conv-${entry.id ?? entry.timestamp}`,
          timestamp: new Date(entry.timestamp).getTime(),
          entry,
        })
      } else {
        // Only show queue/operator engine entries in console
        const eventName = entry.event ?? ""
        if (!eventName.startsWith("queue:") && !eventName.startsWith("operator:")) continue
        const cat = getEventCategory(eventName)
        if (!enabledCategories.has(cat)) continue
        if (q) {
          const text = `${entry.event ?? ""} ${getEngineEventSummary(entry)}`.toLowerCase()
          if (!text.includes(q)) continue
        }
        items.push({
          kind: "engine-log-entry",
          id: `log-${entry.timestamp}-${entry.event ?? ""}`,
          timestamp: new Date(entry.timestamp).getTime(),
          entry,
        })
      }
    }

    // Pending messages
    if (showOp) {
      for (const entry of pendingMessages) {
        if (q && !(entry.message ?? "").toLowerCase().includes(q)) continue
        items.push({
          kind: "operator-message",
          id: `pending-${entry.id ?? entry.timestamp}`,
          timestamp: new Date(entry.timestamp).getTime(),
          entry,
        })
      }
    }

    // Live queue events (SSE)
    for (const ev of engineEvents) {
      if (!enabledCategories.has(ev.category)) continue
      if (q) {
        const text = `${ev.label} ${ev.summary}`.toLowerCase()
        if (!text.includes(q)) continue
      }
      items.push({
        kind: "engine-event",
        id: `ev-${ev.id}`,
        timestamp: ev.timestamp,
        ev,
      })
    }

    items.sort((a, b) => a.timestamp - b.timestamp)
    return items.length > maxLines ? items.slice(-maxLines) : items
  }, [conversation, pendingMessages, engineEvents, slug, showOp, enabledCategories, searchQuery, maxLines])

  // Autoscroll on feed change
  useEffect(() => {
    if (autoScrollRef.current) {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
    } else {
      setHasNewBelow(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItems])

  const activeFilterCount =
    (ALL_CATEGORIES.length - enabledCategories.size) +
    (!showOp ? 1 : 0) +
    (searchQuery ? 1 : 0)

  return (
    <div className="flex flex-col h-full p-4 gap-3 max-w-4xl mx-auto w-full">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium whitespace-nowrap">
          Wave {waveNumber}
        </span>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <label htmlFor="max-lines-select" className="text-xs text-muted-foreground whitespace-nowrap">
            Linhas:
          </label>
          <select
            id="max-lines-select"
            value={maxLines}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10)
              setMaxLines(val)
              localStorage.setItem(LS_MAX_LINES_KEY, String(val))
            }}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {MAX_LINES_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent transition-colors relative"
          aria-expanded={filtersOpen}
        >
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {activeFilterCount > 0 && (
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${filtersOpen ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Filter panel */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showOp}
                    onChange={(e) => setShowOp(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-primary"
                  />
                  <span className="text-muted-foreground">Mensagens do operador</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enabledCategories.has("queue")}
                    onChange={(e) => handleCategoryToggle("queue", e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-primary"
                  />
                  <span className={`px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS.queue}`}>
                    Eventos da fila
                  </span>
                </label>
              </div>
              <div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por conteúdo…"
                  className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feed */}
      <div className="relative flex-1 min-h-0">
        <div ref={feedRef} onScroll={handleFeedScroll} className="h-full overflow-y-auto space-y-2 py-1">
          {feedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aguardando mensagens e eventos…
            </p>
          )}
          <AnimatePresence initial={false}>
            {feedItems.map((item) =>
              item.kind === "operator-message" ? (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="flex justify-end"
                >
                  <div className="max-w-[72%] rounded-lg border border-border bg-primary/10 px-4 py-2.5 text-sm">
                    <p className="break-words">{item.entry.message}</p>
                    <div className="mt-1.5 flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelative(item.timestamp)}
                      </span>
                      {item.entry.pending ? (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-yellow-500/15 text-yellow-700 dark:text-yellow-400">
                          pending
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-500/15 text-green-700 dark:text-green-400">
                          processed
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : item.kind === "engine-log-entry" ? (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="flex justify-start"
                >
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm max-w-[85%]">
                    <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[getEventCategory(item.entry.event ?? "")]}`}>
                      {getEventCategory(item.entry.event ?? "")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-medium text-foreground truncate">{item.entry.event}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {getEngineEventSummary(item.entry)}
                      </p>
                    </div>
                    <time
                      dateTime={item.entry.timestamp}
                      className="shrink-0 text-xs text-muted-foreground whitespace-nowrap cursor-default"
                    >
                      {formatRelative(item.timestamp)}
                    </time>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className="flex justify-start"
                >
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm max-w-[85%]">
                    <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[item.ev.category]}`}>
                      {item.ev.category}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-xs font-medium text-foreground truncate">{item.ev.label}</p>
                      {item.ev.summary && (
                        <p className="mt-0.5 text-xs text-muted-foreground truncate">{item.ev.summary}</p>
                      )}
                    </div>
                    <time
                      dateTime={new Date(item.ev.timestamp).toISOString()}
                      className="shrink-0 text-xs text-muted-foreground whitespace-nowrap cursor-default"
                    >
                      {formatRelative(item.ev.timestamp)}
                    </time>
                  </div>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {hasNewBelow && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10"
            >
              <button
                onClick={scrollToBottom}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/90 backdrop-blur-sm px-4 py-1.5 text-sm font-medium shadow-md hover:bg-accent transition-colors"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                Novas entradas
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Message input */}
      <div className="rounded-lg border border-input bg-muted/40 px-3 py-2.5 flex gap-2 dark:bg-muted/20">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem para a engine…"
          disabled={sending}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={!text.trim() || sending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
          Enviar
        </button>
      </div>
    </div>
  )
}

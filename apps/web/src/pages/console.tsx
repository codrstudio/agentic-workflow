import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Send, Filter, ChevronDown, ArrowDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useSearch, useNavigate } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"
import { useSSEContext, type SSEEvent } from "@/contexts/sse-context"

// ---- Constants ----

const MAX_EVENTS = 500

type EventCategory = "workflow" | "feature" | "agent" | "loop" | "gutter" | "queue"
type MessageStatus = "queued" | "processing" | "done"

const ALL_CATEGORIES: EventCategory[] = ["workflow", "feature", "agent", "loop", "gutter", "queue"]

const CATEGORY_COLORS: Record<EventCategory, string> = {
  workflow: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  feature:  "bg-green-500/15 text-green-700 dark:text-green-400",
  agent:    "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  loop:     "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  gutter:   "bg-red-500/15 text-red-700 dark:text-red-400",
  queue:    "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
}

const STATUS_LABELS: Record<MessageStatus, string> = {
  queued: "pending",
  processing: "delivered",
  done: "processed",
}

const STATUS_COLORS: Record<MessageStatus, string> = {
  queued: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  processing: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  done: "bg-green-500/15 text-green-700 dark:text-green-400",
}

// Event types to subscribe for the engine events feed
const ENGINE_EVENT_TYPES = [
  "engine:event",
  "engine:log",
  "run:started",
  "run:completed",
  "run:failed",
  "agent:action:start",
  "agent:action:end",
]

// ---- Helpers (ported from events.tsx) ----

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
  if (type === "engine:log") {
    const line = d.line as string | undefined
    return line ? line.slice(0, 80) : ""
  }
  return ""
}

function getEventSlug(type: string, data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const d = data as Record<string, unknown>
  const slug = d.slug as string | undefined
  if (slug) return slug
  const ps = d.project_slug as string | undefined
  return ps
}

function formatRelative(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 5) return "agora"
  if (diff < 60) return `${diff}s atrás`
  if (diff < 3600) return `${Math.floor(diff / 60)}m atrás`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`
  return `${Math.floor(diff / 86400)}d atrás`
}

// ---- Types ----

interface HubMessage {
  id: string
  timestamp: string
  message: string
  source?: string
  status: MessageStatus
}

interface EngineEventItem extends SSEEvent {
  id: string
  category: EventCategory
  label: string
  summary: string
}

interface Project {
  name: string
  slug: string
}

type FeedItem =
  | { kind: "operator-message"; id: string; timestamp: number; msg: HubMessage }
  | { kind: "engine-event"; id: string; timestamp: number; ev: EngineEventItem }

let _id = 0
function nextId() {
  return String(++_id)
}

// ---- Filter Panel ----

interface FilterPanelProps {
  enabledCategories: Set<EventCategory>
  showOp: boolean
  searchQuery: string
  onCategoryToggle: (cat: EventCategory, checked: boolean) => void
  onShowOpChange: (checked: boolean) => void
  onSearchQueryChange: (q: string) => void
}

function FilterPanel({
  enabledCategories,
  showOp,
  searchQuery,
  onCategoryToggle,
  onShowOpChange,
  onSearchQueryChange,
}: FilterPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        {/* Category checkboxes */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Categorias de evento
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {ALL_CATEGORIES.map((cat) => (
              <label
                key={cat}
                className="flex items-center gap-1.5 text-xs cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={enabledCategories.has(cat)}
                  onChange={(e) => onCategoryToggle(cat, e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-primary"
                />
                <span className={`px-1.5 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[cat]}`}>
                  {cat}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Operator messages toggle */}
        <div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showOp}
              onChange={(e) => onShowOpChange(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-primary"
            />
            <span className="text-muted-foreground">Mensagens do operador</span>
          </label>
        </div>

        {/* Text search */}
        <div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Buscar por conteúdo…"
            className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </motion.div>
  )
}

// ---- Sub-components ----

function OperatorMessageRow({ msg }: { msg: HubMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex justify-end"
    >
      <div className="max-w-[72%] rounded-lg border border-border bg-primary/10 px-4 py-2.5 text-sm">
        <p className="break-words">{msg.message}</p>
        <div className="mt-1.5 flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {formatRelative(new Date(msg.timestamp).getTime())}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[msg.status]}`}
          >
            {STATUS_LABELS[msg.status]}
          </span>
        </div>
      </div>
    </motion.div>
  )
}

function EngineEventRow({ ev }: { ev: EngineEventItem }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex justify-start"
    >
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm max-w-[85%]">
        <span
          className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[ev.category]}`}
        >
          {ev.category}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-xs font-medium text-foreground truncate">{ev.label}</p>
          {ev.summary && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">{ev.summary}</p>
          )}
        </div>
        <time
          dateTime={new Date(ev.timestamp).toISOString()}
          className="shrink-0 text-xs text-muted-foreground whitespace-nowrap cursor-default"
        >
          {formatRelative(ev.timestamp)}
        </time>
      </div>
    </motion.div>
  )
}

// ---- Main Component ----

export function ConsolePage() {
  const { subscribe } = useSSEContext()
  const navigate = useNavigate()
  const { project: selectedSlug, cats: catsParam, op: showOp, q: searchQuery } = useSearch({
    from: "/console",
  })

  const [projects, setProjects] = useState<Project[]>([])
  const [messages, setMessages] = useState<HubMessage[]>([])
  const [engineEvents, setEngineEvents] = useState<EngineEventItem[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [hasNewBelow, setHasNewBelow] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const autoScrollRef = useRef(true)
  const selectedSlugRef = useRef(selectedSlug)
  selectedSlugRef.current = selectedSlug

  // Parse enabled categories from URL
  const enabledCategories = useMemo<Set<EventCategory>>(() => {
    if (!catsParam) return new Set(ALL_CATEGORIES)
    const parsed = catsParam
      .split(",")
      .filter((c): c is EventCategory => ALL_CATEGORIES.includes(c as EventCategory))
    return parsed.length > 0 ? new Set(parsed) : new Set(ALL_CATEGORIES)
  }, [catsParam])

  // Filter handlers (update URL search params)
  const handleProjectChange = (slug: string) => {
    setMessages([])
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, project: slug }), replace: true })
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const handleCategoryToggle = (cat: EventCategory, checked: boolean) => {
    const next = new Set(enabledCategories)
    if (checked) next.add(cat)
    else next.delete(cat)
    const catsStr = next.size === ALL_CATEGORIES.length ? "" : [...next].join(",")
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, cats: catsStr }), replace: true })
  }

  const handleShowOpChange = (checked: boolean) => {
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, op: checked }), replace: true })
  }

  const handleSearchQueryChange = (q: string) => {
    void navigate({ search: (prev: Record<string, unknown>) => ({ ...prev, q }), replace: true })
  }

  // Fetch projects on mount
  useEffect(() => {
    apiFetch("/api/v1/projects")
      .then((r) => r.json() as Promise<Project[]>)
      .then((data) => {
        setProjects(data)
      })
      .catch(() => undefined)
  }, [])

  // Auto-select first project if none selected
  useEffect(() => {
    if (!selectedSlug && projects.length > 0 && projects[0]) {
      void navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, project: projects[0]!.slug }),
        replace: true,
      })
    }
  }, [selectedSlug, projects, navigate])

  // Fetch messages when project changes
  useEffect(() => {
    if (!selectedSlug) {
      setMessages([])
      return
    }
    apiFetch(`/api/v1/projects/${selectedSlug}/messages`)
      .then((r) => r.json() as Promise<HubMessage[]>)
      .then((data) => setMessages(data))
      .catch(() => undefined)
  }, [selectedSlug])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // SSE: new operator message queued
  const handleQueued = useCallback((event: SSEEvent) => {
    const payload = event.data as { slug?: string; message?: HubMessage }
    if (payload.slug !== selectedSlugRef.current || !payload.message) return
    setMessages((prev) => {
      const exists = prev.some((m) => m.id === payload.message!.id)
      return exists ? prev : [...prev, payload.message!]
    })
  }, [])

  useEffect(() => {
    return subscribe("operator:message:queued", handleQueued)
  }, [subscribe, handleQueued])

  // SSE: engine:event — also updates operator message status
  const handleEngineEvent = useCallback((event: SSEEvent) => {
    const payload = event.data as { slug?: string; payload?: { type?: string } }
    // Update operator message status for current project
    if (payload.slug === selectedSlugRef.current) {
      const innerType = payload.payload?.type
      if (innerType === "queue:processing") {
        setMessages((prev) =>
          prev.map((m) => (m.status === "queued" ? { ...m, status: "processing" } : m))
        )
      } else if (innerType === "queue:done") {
        setMessages((prev) =>
          prev.map((m) => (m.status === "processing" ? { ...m, status: "done" } : m))
        )
      }
    }
    // Add to engine events feed
    const feedEv: EngineEventItem = {
      ...event,
      id: nextId(),
      category: getCategory(event.type, event.data),
      label: getLabel(event.type, event.data),
      summary: getSummary(event.type, event.data),
    }
    setEngineEvents((prev) => {
      const next = [...prev, feedEv]
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next
    })
  }, [])

  // SSE: other engine event types (run:*, agent:action:*, engine:log)
  const handleOtherEvent = useCallback((event: SSEEvent) => {
    const feedEv: EngineEventItem = {
      ...event,
      id: nextId(),
      category: getCategory(event.type, event.data),
      label: getLabel(event.type, event.data),
      summary: getSummary(event.type, event.data),
    }
    setEngineEvents((prev) => {
      const next = [...prev, feedEv]
      return next.length > MAX_EVENTS ? next.slice(next.length - MAX_EVENTS) : next
    })
  }, [])

  useEffect(() => {
    const unsub = subscribe("engine:event", handleEngineEvent)
    const otherUnsubs = ENGINE_EVENT_TYPES.filter((t) => t !== "engine:event").map((t) =>
      subscribe(t, handleOtherEvent)
    )
    return () => {
      unsub()
      otherUnsubs.forEach((u) => u())
    }
  }, [subscribe, handleEngineEvent, handleOtherEvent])

  // Send operator message
  const sendMessage = async () => {
    const content = text.trim()
    if (!content || !selectedSlug || sending) return
    setSending(true)
    try {
      const res = await apiFetch(`/api/v1/projects/${selectedSlug}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      })
      if (res.ok) {
        const msg = (await res.json()) as HubMessage
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id)
          return exists ? prev : [...prev, msg]
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

  // Autoscroll: scroll handler detects position
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

  // Autoscroll: when feed items change, scroll to bottom if autoscroll active
  useEffect(() => {
    if (autoScrollRef.current) {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
    } else {
      setHasNewBelow(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItems])

  // Scroll to bottom and reactivate autoscroll
  const scrollToBottom = useCallback(() => {
    autoScrollRef.current = true
    setHasNewBelow(false)
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" })
  }, [])

  // Build unified chronological feed with filters applied
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []
    const q = searchQuery.toLowerCase()

    // Operator messages (already filtered by selectedSlug via fetch)
    if (showOp) {
      for (const msg of messages) {
        if (q && !msg.message.toLowerCase().includes(q)) continue
        items.push({
          kind: "operator-message",
          id: `msg-${msg.id}`,
          timestamp: new Date(msg.timestamp).getTime(),
          msg,
        })
      }
    }

    // Engine events — filter by selectedSlug, category, and text
    for (const ev of engineEvents) {
      if (!enabledCategories.has(ev.category)) continue
      if (selectedSlug) {
        const slug = getEventSlug(ev.type, ev.data)
        if (slug && slug !== selectedSlug) continue
      }
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

    // Sort ascending by timestamp (oldest first → newest at bottom, chat style)
    return items.sort((a, b) => a.timestamp - b.timestamp)
  }, [messages, engineEvents, selectedSlug, showOp, enabledCategories, searchQuery])

  const emptyMessage = selectedSlug
    ? "Aguardando mensagens e eventos…"
    : "Selecione um projeto ou aguarde eventos globais."

  // Count active filters for badge
  const activeFilterCount =
    (catsParam ? ALL_CATEGORIES.length - enabledCategories.size : 0) +
    (!showOp ? 1 : 0) +
    (searchQuery ? 1 : 0)

  return (
    <div className="flex flex-col h-full p-4 gap-3 max-w-4xl mx-auto w-full">
      {/* Top bar: project select + filters toggle */}
      <div className="flex items-center gap-2">
        <label htmlFor="project-select" className="text-sm font-medium whitespace-nowrap">
          Projeto:
        </label>
        <select
          id="project-select"
          value={selectedSlug}
          onChange={(e) => handleProjectChange(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos os projetos</option>
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} ({p.slug})
            </option>
          ))}
        </select>

        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent transition-colors relative"
          aria-expanded={filtersOpen}
          aria-label="Abrir painel de filtros"
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

      {/* Collapsible filter panel */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <FilterPanel
            enabledCategories={enabledCategories}
            showOp={showOp}
            searchQuery={searchQuery}
            onCategoryToggle={handleCategoryToggle}
            onShowOpChange={handleShowOpChange}
            onSearchQueryChange={handleSearchQueryChange}
          />
        )}
      </AnimatePresence>

      {/* Unified feed */}
      <div className="relative flex-1 min-h-0">
        <div
          ref={feedRef}
          onScroll={handleFeedScroll}
          className="h-full overflow-y-auto space-y-2"
        >
          {feedItems.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">{emptyMessage}</p>
          )}
          <AnimatePresence initial={false}>
            {feedItems.map((item) =>
              item.kind === "operator-message" ? (
                <OperatorMessageRow key={item.id} msg={item.msg} />
              ) : (
                <EngineEventRow key={item.id} ev={item.ev} />
              )
            )}
          </AnimatePresence>
        </div>

        {/* Floating button: shown when there is new content below and autoscroll is suspended */}
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
      <div className="flex gap-2 border-t border-border pt-3">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedSlug ? "Digite uma mensagem para a engine…" : "Selecione um projeto para enviar mensagens"
          }
          disabled={!selectedSlug || sending}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />
        <button
          onClick={() => void sendMessage()}
          disabled={!text.trim() || !selectedSlug || sending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-4 h-4" />
          Enviar
        </button>
      </div>
    </div>
  )
}

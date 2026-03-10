import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Send } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { apiFetch } from "@/lib/api"
import { useSSEContext, type SSEEvent } from "@/contexts/sse-context"

// ---- Constants ----

const MAX_EVENTS = 500

type EventCategory = "workflow" | "feature" | "agent" | "loop" | "gutter" | "queue"
type MessageStatus = "queued" | "processing" | "done"

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
// (operator:message:queued is handled separately via its own subscription)
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
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string>("")
  const [messages, setMessages] = useState<HubMessage[]>([])
  const [engineEvents, setEngineEvents] = useState<EngineEventItem[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedSlugRef = useRef(selectedSlug)
  selectedSlugRef.current = selectedSlug

  // Fetch projects on mount
  useEffect(() => {
    apiFetch("/api/v1/projects")
      .then((r) => r.json() as Promise<Project[]>)
      .then((data) => {
        setProjects(data)
        if (data.length > 0 && data[0]) {
          setSelectedSlug(data[0].slug)
        }
      })
      .catch(() => undefined)
  }, [])

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

  const handleProjectChange = (slug: string) => {
    setSelectedSlug(slug)
    setMessages([])
    setTimeout(() => inputRef.current?.focus(), 0)
  }

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

  // Build unified chronological feed
  const feedItems = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = []

    // Operator messages (already filtered by selectedSlug via fetch)
    for (const msg of messages) {
      items.push({
        kind: "operator-message",
        id: `msg-${msg.id}`,
        timestamp: new Date(msg.timestamp).getTime(),
        msg,
      })
    }

    // Engine events — filter by selectedSlug when one is selected
    for (const ev of engineEvents) {
      if (selectedSlug) {
        const slug = getEventSlug(ev.type, ev.data)
        if (slug && slug !== selectedSlug) continue
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
  }, [messages, engineEvents, selectedSlug])

  const emptyMessage = selectedSlug
    ? "Aguardando mensagens e eventos…"
    : "Selecione um projeto ou aguarde eventos globais."

  return (
    <div className="flex flex-col h-full p-4 gap-4 max-w-4xl mx-auto w-full">
      {/* Project select */}
      <div className="flex items-center gap-3">
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
      </div>

      {/* Unified feed */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
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

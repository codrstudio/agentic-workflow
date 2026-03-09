import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, ChevronUp, Pause, Play, X } from "lucide-react"
import { useSSEContext, type SSEEvent } from "@/contexts/sse-context"
import { apiFetch } from "@/lib/api"

const MAX_EVENTS = 500

type EventCategory = "workflow" | "feature" | "agent" | "loop" | "gutter" | "queue"

const CATEGORIES: EventCategory[] = ["workflow", "feature", "agent", "loop", "gutter", "queue"]

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

function getEventSlug(type: string, data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const d = data as Record<string, unknown>
  // engine:event, run:* events carry a top-level slug
  const slug = d.slug as string | undefined
  if (slug) return slug
  // agent:action:* carry project_slug
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

interface Project {
  name: string
  slug: string
}

let _id = 0
function nextId() {
  return String(++_id)
}

// Parse filter state from URL search params
function parseFiltersFromURL(): { types: Set<EventCategory>; project: string; q: string } {
  const params = new URLSearchParams(window.location.search)
  const typesRaw = params.get("types") ?? ""
  const types = new Set<EventCategory>(
    typesRaw
      .split(",")
      .filter((t): t is EventCategory => CATEGORIES.includes(t as EventCategory))
  )
  return {
    types,
    project: params.get("project") ?? "",
    q: params.get("q") ?? "",
  }
}

// Sync filter state to URL without triggering router navigation
function syncFiltersToURL(types: Set<EventCategory>, project: string, q: string) {
  const params = new URLSearchParams()
  if (types.size > 0) params.set("types", [...types].join(","))
  if (project) params.set("project", project)
  if (q) params.set("q", q)
  const search = params.toString()
  const newUrl = search
    ? `${window.location.pathname}?${search}`
    : window.location.pathname
  window.history.replaceState(null, "", newUrl)
}

export function EventsPage() {
  const { subscribe } = useSSEContext()
  const [events, setEvents] = useState<FeedEvent[]>([])
  const [paused, setPaused] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  // Filter state — initialized from URL
  const [selectedTypes, setSelectedTypes] = useState<Set<EventCategory>>(
    () => parseFiltersFromURL().types
  )
  const [projectFilter, setProjectFilter] = useState<string>(
    () => parseFiltersFromURL().project
  )
  const [textFilter, setTextFilter] = useState<string>(
    () => parseFiltersFromURL().q
  )
  const [filtersOpen, setFiltersOpen] = useState(
    () => {
      const { types, project, q } = parseFiltersFromURL()
      return types.size > 0 || !!project || !!q
    }
  )
  const [projects, setProjects] = useState<Project[]>([])

  // Sync filters to URL whenever they change
  useEffect(() => {
    syncFiltersToURL(selectedTypes, projectFilter, textFilter)
  }, [selectedTypes, projectFilter, textFilter])

  // Fetch available projects for the select dropdown
  useEffect(() => {
    apiFetch("/api/v1/projects")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Project[]) => setProjects(data))
      .catch(() => {/* silently ignore */})
  }, [])

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

  // Apply filters (AND logic)
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      // Type/category filter
      if (selectedTypes.size > 0 && !selectedTypes.has(ev.category)) return false
      // Project filter
      if (projectFilter) {
        const slug = getEventSlug(ev.type, ev.data)
        if (slug && slug !== projectFilter) return false
      }
      // Text filter
      if (textFilter) {
        const q = textFilter.toLowerCase()
        const inLabel = ev.label.toLowerCase().includes(q)
        const inSummary = ev.summary.toLowerCase().includes(q)
        if (!inLabel && !inSummary) return false
      }
      return true
    })
  }, [events, selectedTypes, projectFilter, textFilter])

  const activeFilterCount =
    selectedTypes.size + (projectFilter ? 1 : 0) + (textFilter ? 1 : 0)

  function toggleType(cat: EventCategory) {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function clearFilters() {
    setSelectedTypes(new Set())
    setProjectFilter("")
    setTextFilter("")
  }

  return (
    <div className="flex flex-col h-full p-4 gap-3 max-w-5xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Feed de Eventos</h1>
          <p className="text-xs text-muted-foreground">
            {filteredEvents.length}{filteredEvents.length !== events.length && ` / ${events.length}`} evento{events.length !== 1 ? "s" : ""}
            {" "}· máx {MAX_EVENTS}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter toggle */}
          <button
            onClick={() => setFiltersOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted"
            aria-expanded={filtersOpen}
          >
            {filtersOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            Filtros
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center size-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {/* Pause toggle */}
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

      {/* Filter panel */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-lg border border-border bg-card p-3 space-y-3">
              {/* Category checkboxes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Tipo de evento</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <label
                      key={cat}
                      className="inline-flex items-center gap-1.5 cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypes.has(cat)}
                        onChange={() => toggleType(cat)}
                        className="rounded border-border size-3.5 accent-primary"
                      />
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[cat]}`}
                      >
                        {cat}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Project select */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Projeto</p>
                  <select
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Todos os projetos</option>
                    {projects.map((p) => (
                      <option key={p.slug} value={p.slug}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Text search */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Busca textual</p>
                  <div className="relative">
                    <input
                      type="text"
                      value={textFilter}
                      onChange={(e) => setTextFilter(e.target.value)}
                      placeholder="Filtrar por conteúdo…"
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 pr-7 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {textFilter && (
                      <button
                        onClick={() => setTextFilter("")}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label="Limpar busca"
                      >
                        <X className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Clear all */}
              {activeFilterCount > 0 && (
                <div className="flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="size-3" />
                    Limpar filtros
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Event list */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto space-y-1.5 min-h-0"
      >
        {filteredEvents.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-16">
            {events.length === 0
              ? "Aguardando eventos SSE…"
              : "Nenhum evento corresponde aos filtros ativos."}
          </p>
        )}
        <AnimatePresence initial={false}>
          {filteredEvents.map((ev) => (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2 text-sm"
            >
              {/* Category badge */}
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

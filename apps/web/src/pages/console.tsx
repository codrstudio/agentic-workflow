import { useEffect, useRef, useState, useCallback } from "react"
import { Send } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { useSSEContext } from "@/contexts/sse-context"

interface Project {
  name: string
  slug: string
}

type MessageStatus = "queued" | "processing" | "done"

interface HubMessage {
  id: string
  timestamp: string
  message: string
  source?: string
  status: MessageStatus
}

function formatRelativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return "agora"
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  return `há ${Math.floor(diff / 86400)} d`
}

function StatusBadge({ status }: { status: MessageStatus }) {
  const classes: Record<MessageStatus, string> = {
    queued: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
    processing: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    done: "bg-green-500/15 text-green-700 dark:text-green-400",
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${classes[status]}`}
    >
      {status}
    </span>
  )
}

export function ConsolePage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedSlug, setSelectedSlug] = useState<string>("")
  const [messages, setMessages] = useState<HubMessage[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const { subscribe } = useSSEContext()

  // Fetch projects list on mount
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
    if (!selectedSlug) return
    apiFetch(`/api/v1/projects/${selectedSlug}/messages`)
      .then((r) => r.json() as Promise<HubMessage[]>)
      .then((data) => setMessages(data))
      .catch(() => undefined)
  }, [selectedSlug])

  // Auto-focus input on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Re-focus after project select
  const handleProjectChange = (slug: string) => {
    setSelectedSlug(slug)
    setMessages([])
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  // SSE: new message queued
  const handleQueued = useCallback(
    (event: { data: unknown }) => {
      const payload = event.data as { slug?: string; message?: HubMessage }
      if (payload.slug !== selectedSlug || !payload.message) return
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === payload.message!.id)
        return exists ? prev : [...prev, payload.message!]
      })
    },
    [selectedSlug]
  )

  useEffect(() => {
    const unsub = subscribe("operator:message:queued", handleQueued)
    return unsub
  }, [subscribe, handleQueued])

  // SSE: status changes (engine events)
  const handleEngineEvent = useCallback(
    (event: { data: unknown }) => {
      const payload = event.data as { slug?: string; payload?: { type?: string } }
      if (payload.slug !== selectedSlug) return
      const engineType = payload.payload?.type
      if (engineType === "queue:processing") {
        setMessages((prev) =>
          prev.map((m) => (m.status === "queued" ? { ...m, status: "processing" } : m))
        )
      } else if (engineType === "queue:done") {
        setMessages((prev) =>
          prev.map((m) => (m.status === "processing" ? { ...m, status: "done" } : m))
        )
      }
    },
    [selectedSlug]
  )

  useEffect(() => {
    const unsub = subscribe("engine:event", handleEngineEvent)
    return unsub
  }, [subscribe, handleEngineEvent])

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

  // Reverse chronological order
  const sortedMessages = [...messages].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="flex flex-col h-full p-4 gap-4 max-w-3xl mx-auto w-full">
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
          {projects.length === 0 && (
            <option value="" disabled>
              Nenhum projeto disponível
            </option>
          )}
          {projects.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name} ({p.slug})
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem para a engine…"
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

      <div className="flex-1 overflow-y-auto space-y-2">
        {sortedMessages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            {selectedSlug ? "Nenhuma mensagem enviada ainda." : "Selecione um projeto para começar."}
          </p>
        )}
        {sortedMessages.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
          >
            <div className="flex-1 min-w-0">
              <p className="break-words">{msg.message}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <StatusBadge status={msg.status} />
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatRelativeTime(msg.timestamp)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouterState } from "@tanstack/react-router"
import { MessageSquare, X, Send, Loader2, Bot, User } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { apiFetch } from "@/lib/api"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

/** Derive page context from the current route */
function usePageContext(): { entity?: string; slug?: string; route: string } {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const match = pathname.match(/^\/library\/(workflows|tasks|agents|plans)(?:\/(.+))?/)
  if (match) {
    return { entity: match[1], slug: match[2], route: pathname }
  }
  return { route: pathname }
}

export function CopilotDrawer() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const ctx = usePageContext()

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || streaming) return

    const userMsg: ChatMessage = { role: "user", content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput("")
    setStreaming(true)

    try {
      const res = await apiFetch("/api/v1/library/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: updated.slice(-20), // last 20 messages for context
          context: { route: ctx.route, entity: ctx.entity, slug: ctx.slug },
        }),
      })

      if (!res.ok) {
        const err = await res.json() as { error?: string }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Erro: ${err.error ?? "Falha na requisição"}` },
        ])
        return
      }

      // Streaming SSE response
      const reader = res.body?.getReader()
      if (!reader) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Erro: sem resposta do servidor" },
        ])
        return
      }

      let assistantContent = ""
      setMessages((prev) => [...prev, { role: "assistant", content: "" }])
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6)
            if (data === "[DONE]") continue
            try {
              const parsed = JSON.parse(data) as { content?: string; error?: string }
              if (parsed.error) {
                assistantContent += `\n\nErro: ${parsed.error}`
              } else if (parsed.content) {
                assistantContent += parsed.content
              }
              setMessages((prev) => {
                const copy = [...prev]
                copy[copy.length - 1] = { role: "assistant", content: assistantContent }
                return copy
              })
            } catch {
              // skip malformed JSON
            }
          }
        }
      }

      // If no content was streamed, show fallback
      if (!assistantContent) {
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = {
            role: "assistant",
            content: "Sem resposta do agente.",
          }
          return copy
        })
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Erro de conexão: ${e instanceof Error ? e.message : "desconhecido"}`,
        },
      ])
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  // Context label
  const contextLabel = ctx.entity
    ? ctx.slug
      ? `${ctx.entity}/${ctx.slug}`
      : ctx.entity
    : null

  return (
    <>
      {/* FAB button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-all hover:scale-105"
          title="Copilot"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed top-0 right-0 z-50 h-full w-[420px] max-w-full bg-background border-l border-border shadow-2xl flex flex-col transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-14 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Copilot</span>
            {contextLabel && (
              <span className="text-xs font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                {contextLabel}
              </span>
            )}
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-1 rounded hover:bg-muted text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 text-center">
              <Bot className="w-8 h-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Posso ajudar a criar e modificar workflows, tasks, agents e plans.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Pergunte ou peça algo.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <Bot className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              )}
              <div
                className={cn(
                  "rounded-lg px-3 py-2 text-sm max-w-[85%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                {msg.role === "assistant" ? (
                  <MarkdownViewer content={msg.content || "..."} />
                ) : (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                )}
              </div>
              {msg.role === "user" && (
                <User className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              )}
            </div>
          ))}

          {streaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3 h-3 animate-spin" />
              Processando...
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mensagem..."
              disabled={streaming}
              rows={1}
              className="flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              style={{ maxHeight: "120px" }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = Math.min(el.scrollHeight, 120) + "px"
              }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || streaming}
              className="flex items-center justify-center w-9 h-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}

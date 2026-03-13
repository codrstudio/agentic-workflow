import * as React from "react"

export type SSEStatus = "connected" | "reconnecting" | "disconnected"

export interface SSEEvent {
  type: string
  data: unknown
  timestamp: number
}

export interface UseSSEReturn {
  status: SSEStatus
  events: SSEEvent[]
  subscribe: (eventType: string, callback: (event: SSEEvent) => void) => () => void
}

interface SSEOptions {
  url?: string
  bufferSize?: number
}

const DEFAULT_URL = "/api/v1/events"
const DEFAULT_BUFFER_SIZE = 100
const INITIAL_RETRY_MS = 1_000
const MAX_RETRY_MS = 30_000

// Event types emitted by the hub — pre-registered so the ring buffer captures all of them
const KNOWN_EVENT_TYPES = [
  "engine:event",
  "engine:log",
  "run:started",
  "run:completed",
  "run:failed",
  "agent:action:start",
  "agent:action:end",
  "monitor:snapshot",
]

export function useSSE(options: SSEOptions = {}): UseSSEReturn {
  const url = options.url ?? DEFAULT_URL
  const bufferSize = options.bufferSize ?? DEFAULT_BUFFER_SIZE

  const [status, setStatus] = React.useState<SSEStatus>("disconnected")
  const [events, setEvents] = React.useState<SSEEvent[]>([])

  // Stable refs — avoid stale closures
  const subscribersRef = React.useRef<Map<string, Set<(event: SSEEvent) => void>>>(new Map())
  const retryMsRef = React.useRef(INITIAL_RETRY_MS)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const esRef = React.useRef<EventSource | null>(null)
  const listeningTypesRef = React.useRef<Set<string>>(new Set())
  const bufferSizeRef = React.useRef(bufferSize)
  bufferSizeRef.current = bufferSize

  // Dispatch a parsed event into the ring buffer and notify subscribers
  const dispatchEvent = React.useCallback((sseEvent: SSEEvent) => {
    setEvents((prev) => {
      const next = [...prev, sseEvent]
      const cap = bufferSizeRef.current
      return next.length > cap ? next.slice(next.length - cap) : next
    })
    const subs = subscribersRef.current.get(sseEvent.type)
    if (subs) subs.forEach((cb) => cb(sseEvent))
  }, [])

  const dispatchRef = React.useRef(dispatchEvent)
  dispatchRef.current = dispatchEvent

  // Add an EventSource listener for a named event type (idempotent)
  const addTypeListener = React.useCallback((es: EventSource, type: string) => {
    if (listeningTypesRef.current.has(type)) return
    listeningTypesRef.current.add(type)
    es.addEventListener(type, (raw: MessageEvent<string>) => {
      let data: unknown = raw.data
      try {
        data = JSON.parse(raw.data) as unknown
      } catch {
        // keep raw string
      }
      dispatchRef.current({ type, data, timestamp: Date.now() })
    })
  }, [])

  // Keep a stable ref to the connect function to avoid circular deps
  const connectRef = React.useRef<() => void>(() => undefined)

  connectRef.current = () => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    listeningTypesRef.current = new Set()

    const es = new EventSource(url, { withCredentials: true })
    esRef.current = es

    es.onopen = () => {
      setStatus("connected")
      retryMsRef.current = INITIAL_RETRY_MS
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      setStatus("reconnecting")
      const delay = retryMsRef.current
      retryMsRef.current = Math.min(delay * 2, MAX_RETRY_MS)
      timeoutRef.current = setTimeout(() => {
        connectRef.current()
      }, delay)
    }

    // Unnamed events (default 'message') — catch-all fallback
    es.onmessage = (raw: MessageEvent<string>) => {
      let data: unknown = raw.data
      try {
        data = JSON.parse(raw.data) as unknown
      } catch {
        // keep raw string
      }
      dispatchRef.current({ type: "message", data, timestamp: Date.now() })
    }

    // Pre-register all known event types so ring buffer captures them
    for (const type of KNOWN_EVENT_TYPES) {
      addTypeListener(es, type)
    }

    // Also register any event types already subscribed by consumers
    subscribersRef.current.forEach((_, type) => {
      addTypeListener(es, type)
    })
  }

  React.useEffect(() => {
    connectRef.current()
    return () => {
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
      if (esRef.current) {
        esRef.current.close()
        esRef.current = null
      }
      setStatus("disconnected")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  const subscribe = React.useCallback(
    (eventType: string, callback: (event: SSEEvent) => void) => {
      if (!subscribersRef.current.has(eventType)) {
        subscribersRef.current.set(eventType, new Set())
      }
      subscribersRef.current.get(eventType)!.add(callback)

      // If already connected, ensure the ES listens to this type
      if (esRef.current) {
        addTypeListener(esRef.current, eventType)
      }

      return () => {
        subscribersRef.current.get(eventType)?.delete(callback)
      }
    },
    [addTypeListener]
  )

  return { status, events, subscribe }
}

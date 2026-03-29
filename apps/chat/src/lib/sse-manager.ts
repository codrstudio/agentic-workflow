type SSEState = "disconnected" | "connecting" | "connected" | "reconnecting"
type SSEListener = (event: MessageEvent) => void

const MAX_RECONNECT_DELAY = 30_000
const BASE_RECONNECT_DELAY = 1_000
const HEARTBEAT_INTERVAL = 60_000
const HEARTBEAT_STALE = 90_000

class SSEManager {
  private static instance: SSEManager
  private eventSource: EventSource | null = null
  private listeners = new Map<string, Set<SSEListener>>()
  private _state: SSEState = "disconnected"
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null
  private lastEventTime = 0
  private url: string | null = null
  private visibilityBound = false

  static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager()
    }
    return SSEManager.instance
  }

  get state(): SSEState {
    return this._state
  }

  connect(url: string): void {
    if (
      this.eventSource?.readyState === EventSource.OPEN &&
      this.url === url
    ) {
      return
    }

    this.disconnect()
    this.url = url
    this._state = "connecting"
    this.createEventSource()

    if (!this.visibilityBound) {
      this.visibilityBound = true
      document.addEventListener("visibilitychange", this.onVisibility)
    }
  }

  disconnect(): void {
    this.eventSource?.close()
    this.eventSource = null
    this._state = "disconnected"
    this.clearTimers()
  }

  on(eventType: string, listener: SSEListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set())
    }
    this.listeners.get(eventType)!.add(listener)

    if (this.eventSource) {
      this.eventSource.addEventListener(eventType, listener)
    }
  }

  off(eventType: string, listener: SSEListener): void {
    this.listeners.get(eventType)?.delete(listener)
    this.eventSource?.removeEventListener(eventType, listener)
  }

  private createEventSource(): void {
    if (!this.url) return

    try {
      this.eventSource = new EventSource(this.url, {
        withCredentials: true,
      })

      this.eventSource.onopen = () => {
        this._state = "connected"
        this.reconnectAttempts = 0
        this.lastEventTime = Date.now()
        this.startHeartbeat()
      }

      this.eventSource.onerror = () => {
        this._state = "reconnecting"
        this.eventSource?.close()
        this.scheduleReconnect()
      }

      // Atualiza timestamp a cada mensagem (heartbeat incluso)
      this.eventSource.onmessage = () => {
        this.lastEventTime = Date.now()
      }

      // Re-registra todos os listeners
      for (const [eventType, listeners] of this.listeners) {
        for (const listener of listeners) {
          this.eventSource.addEventListener(eventType, listener)
        }
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  private scheduleReconnect(): void {
    this.clearTimers()

    const delay = Math.min(
      BASE_RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts),
      MAX_RECONNECT_DELAY
    )
    const jitter = delay * 0.5 * Math.random()

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++
      this.createEventSource()
    }, delay + jitter)
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (Date.now() - this.lastEventTime > HEARTBEAT_STALE) {
        this.eventSource?.close()
        this.scheduleReconnect()
      }
    }, HEARTBEAT_INTERVAL)
  }

  private onVisibility = (): void => {
    if (document.visibilityState === "hidden") {
      this.disconnect()
    } else if (this.url) {
      this.connect(this.url)
    }
  }

  private clearTimers(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    this.reconnectTimer = null
    this.heartbeatTimer = null
  }
}

export const sseManager = SSEManager.getInstance()

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/auth";
import { queryClient } from "@/lib/query-client";

export interface SystemEvent {
  type: string;
  data?: Record<string, unknown>;
}

type SSEListener = (event: SystemEvent) => void;

const listeners = new Set<SSEListener>();

export function subscribeSSE(listener: SSEListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyListeners(event: SystemEvent) {
  listeners.forEach((fn) => fn(event));
}

interface UseSSEOptions {
  enabled?: boolean;
}

interface UseSSEResult {
  connected: boolean;
  lastEvent: SystemEvent | null;
}

const MIN_DELAY = 1_000;
const MAX_DELAY = 30_000;

export function useSSE(options?: UseSSEOptions): UseSSEResult {
  const enabled = options?.enabled ?? true;
  const token = useAuthStore((s) => s.token);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SystemEvent | null>(null);
  const retryDelay = useRef(MIN_DELAY);

  useEffect(() => {
    if (!enabled || !token) {
      setConnected(false);
      return;
    }

    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      es = new EventSource(`/api/v1/ai/system/events?token=${encodeURIComponent(token!)}`);

      es.onopen = () => {
        retryDelay.current = MIN_DELAY;
        setConnected(true);
      };

      es.onmessage = (ev) => {
        try {
          const parsed = JSON.parse(ev.data) as SystemEvent;
          setLastEvent(parsed);
          notifyListeners(parsed);
          invalidateByEvent(parsed);
        } catch {
          // ignore non-JSON messages
        }
      };

      es.onerror = () => {
        es?.close();
        setConnected(false);

        if (!disposed) {
          const delay = retryDelay.current;
          retryDelay.current = Math.min(delay * 2, MAX_DELAY);
          retryTimer = setTimeout(connect, delay);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
      setConnected(false);
    };
  }, [enabled, token]);

  return { connected, lastEvent };
}

export function useSSEEvent(eventType: string, handler: (event: SystemEvent) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    return subscribeSSE((event) => {
      if (event.type === eventType) {
        handlerRef.current(event);
      }
    });
  }, [eventType]);
}

function invalidateByEvent(event: SystemEvent) {
  switch (event.type) {
    case "heartbeat:status": {
      const agentId = event.data?.agentId as string | undefined;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ["agents", agentId, "stats"] });
        queryClient.invalidateQueries({ queryKey: ["agents", agentId, "heartbeat-history"] });
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      break;
    }
    case "registry:adapters":
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      break;
    case "channel:message":
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["inbox"] });
      break;
    case "session:takeover": {
      const sessionId = event.data?.sessionId as string | undefined;
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      if (sessionId) {
        queryClient.invalidateQueries({ queryKey: ["conversations", sessionId, "session"] });
      }
      break;
    }
    case "job:status":
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      break;
    case "notification:new":
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      break;
    case "approval:pending":
      queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
      break;
    case "agent:quota-exceeded": {
      const agentId = event.data?.agentId as string | undefined;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ["quota", agentId] });
        queryClient.invalidateQueries({ queryKey: ["agents", agentId] });
      }
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      break;
    }
    case "circuit_breaker:tripped":
    case "circuit_breaker:resumed":
    case "circuit_breaker:kill_switch": {
      const agentId = event.data?.agentId as string | undefined;
      if (agentId) {
        queryClient.invalidateQueries({ queryKey: ["circuit-breaker", agentId] });
      }
      queryClient.invalidateQueries({ queryKey: ["circuit-breaker", "system"] });
      queryClient.invalidateQueries({ queryKey: ["fleet"] });
      break;
    }
    case "fleet:agent_status":
    case "fleet:alert":
      queryClient.invalidateQueries({ queryKey: ["fleet"] });
      break;
  }
}

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Bot } from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChannelMessage {
  ts: number;
  channelId: string;
  agentId: string;
  role: "assistant" | "user" | "system";
  content: string;
  sessionId?: string;
}

interface ChannelMessageFeedProps {
  channelSlug: string;
}

export function ChannelMessageFeed({ channelSlug }: ChannelMessageFeedProps) {
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;

    let es: EventSource | null = null;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryDelay = 1_000;

    function connect() {
      if (disposed) return;

      es = new EventSource(
        `/api/v1/ai/channels/${encodeURIComponent(channelSlug)}/events?token=${encodeURIComponent(token!)}`,
      );

      es.addEventListener("connected", () => {
        retryDelay = 1_000;
        setConnected(true);
      });

      es.addEventListener("channel:message", (ev: MessageEvent) => {
        try {
          const msg = JSON.parse(ev.data) as ChannelMessage;
          setMessages((prev) => [...prev, msg]);
        } catch {
          // ignore non-JSON
        }
      });

      es.onerror = () => {
        es?.close();
        setConnected(false);
        if (!disposed) {
          retryTimer = setTimeout(connect, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 30_000);
        }
      };
    }

    connect();

    return () => {
      disposed = true;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [token, channelSlug]);

  // Track scroll position on the viewport
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const viewport = root.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]',
    );
    if (!viewport) return;

    function onScroll() {
      const el = viewport!;
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      shouldAutoScroll.current = distanceFromBottom < 80;
    }

    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const getDirection = useCallback(
    (role: ChannelMessage["role"]): "inbound" | "outbound" =>
      role === "user" ? "inbound" : "outbound",
    [],
  );

  const getSender = useCallback((msg: ChannelMessage): string => {
    if (msg.role === "user") return "Contato";
    if (msg.role === "system") return "Sistema";
    return msg.agentId || "Agente";
  }, []);

  if (messages.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed">
        <div className="rounded-full bg-muted p-3">
          <Bot className="size-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Nenhuma mensagem ainda</p>
          <p className="text-xs text-muted-foreground">
            {connected
              ? "Conectado ao canal. Mensagens aparecerao aqui em tempo real."
              : "Conectando ao canal..."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef}>
      <ScrollArea className="h-[500px] rounded-lg border">
        <div className="space-y-3 p-4">
          {messages.map((msg, i) => {
            const isInbound = getDirection(msg.role) === "inbound";

            return (
              <div
                key={`${msg.ts}-${i}`}
                className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-muted/50"
              >
                <div
                  className={`mt-0.5 rounded-full p-1.5 ${
                    isInbound
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isInbound ? (
                    <ArrowDownLeft className="size-3.5" />
                  ) : (
                    <ArrowUpRight className="size-3.5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {getSender(msg)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimestamp(msg.ts)}
                    </span>
                    <span
                      className={`text-[10px] font-medium uppercase ${
                        isInbound ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {isInbound ? "entrada" : "saida"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  if (isToday) return time;

  return `${date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${time}`;
}

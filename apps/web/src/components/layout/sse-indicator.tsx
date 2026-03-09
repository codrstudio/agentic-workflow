import { cn } from "@workspace/ui/lib/utils"
import { useSSEContext, type SSEStatus } from "@/contexts/sse-context"

const STATUS_CONFIG: Record<SSEStatus, { label: string; dotClass: string }> = {
  connected: {
    label: "SSE conectado",
    dotClass: "bg-green-500",
  },
  reconnecting: {
    label: "SSE reconectando…",
    dotClass: "bg-yellow-500 animate-pulse",
  },
  disconnected: {
    label: "SSE desconectado",
    dotClass: "bg-red-500",
  },
}

interface SSEIndicatorProps {
  /** When true, only the dot is rendered (no label text). */
  compact?: boolean
}

export function SSEIndicator({ compact = false }: SSEIndicatorProps) {
  const { status } = useSSEContext()
  const { label, dotClass } = STATUS_CONFIG[status]

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        compact ? "justify-center" : ""
      )}
      title={label}
      aria-label={label}
    >
      <span className={cn("size-2 flex-shrink-0 rounded-full", dotClass)} />
      {!compact && (
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      )}
    </div>
  )
}

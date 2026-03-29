import { Clock, Warning, XCircle, CheckCircle, Pause } from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import type { SLAInfo } from "@workspace/types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function getPriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    urgent: "Urgente",
    high: "Alta",
    normal: "Normal",
    low: "Baixa",
  }
  return map[priority] ?? priority
}

// ─── Full variant ─────────────────────────────────────────────────────────────

interface SLABadgeFullProps {
  sla: SLAInfo
}

function SLABadgeFull({ sla }: SLABadgeFullProps) {
  const { level, status, priority, resolution_minutes, elapsed_minutes, remaining_minutes, warning_percent } = sla

  let icon: React.ReactNode
  let className: string
  let text: string

  if (status === "pending") {
    icon = <Clock className="size-3.5 shrink-0" />
    className = "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
    text = "SLA pendente"
  } else if (status === "paused") {
    icon = <Pause className="size-3.5 shrink-0" />
    className = "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    text = "SLA pausado"
  } else if (status === "completed") {
    icon = <CheckCircle className="size-3.5 shrink-0" />
    className = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    text = "SLA cumprido"
  } else if (level === "expired") {
    const exceededMins = Math.max(0, elapsed_minutes - resolution_minutes)
    icon = <XCircle className="size-3.5 shrink-0" />
    className = "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
    text = exceededMins > 0 ? `expirado há ${formatMinutes(exceededMins)}` : "expirado"
  } else if (level === "critical") {
    icon = <Warning className="size-3.5 shrink-0 animate-pulse" />
    className = "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 animate-pulse"
    text = `SLA: ${formatMinutes(remaining_minutes)} restantes`
  } else if (level === "warning") {
    icon = <Warning className="size-3.5 shrink-0" />
    className = "bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
    text = `SLA: ${formatMinutes(remaining_minutes)} restantes`
  } else {
    // ok
    icon = <Clock className="size-3.5 shrink-0" />
    className = "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    text = `SLA: ${formatMinutes(remaining_minutes)} restantes`
  }

  const tooltipContent = (
    <div className="text-xs space-y-1">
      <p><span className="font-medium">Prioridade:</span> {getPriorityLabel(priority)}</p>
      <p><span className="font-medium">Prazo total:</span> {formatMinutes(resolution_minutes)}</p>
      <p><span className="font-medium">Tempo decorrido:</span> {formatMinutes(elapsed_minutes)}</p>
      {level !== "expired" && status !== "completed" && (
        <p><span className="font-medium">Tempo restante:</span> {formatMinutes(remaining_minutes)}</p>
      )}
      <p><span className="font-medium">Alerta em:</span> {warning_percent}% usado</p>
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap cursor-default",
              className,
            ].join(" ")}
          >
            {icon}
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Compact variant ──────────────────────────────────────────────────────────

interface SLABadgeCompactProps {
  sla: SLAInfo
}

function SLABadgeCompact({ sla }: SLABadgeCompactProps) {
  const { level, status, priority, resolution_minutes, elapsed_minutes, remaining_minutes } = sla

  // Don't show for pending or completed
  if (status === "pending" || status === "completed") return null

  let dotClass: string
  let text: string | null = null
  let levelLabel: string

  if (status === "paused") {
    dotClass = "text-gray-400"
    levelLabel = "Pausado"
  } else if (level === "expired") {
    dotClass = "text-red-600 animate-pulse"
    text = "expirado"
    levelLabel = "Expirado"
  } else if (level === "critical") {
    dotClass = "text-red-600"
    text = `${Math.round(remaining_minutes)}m`
    levelLabel = "Crítico"
  } else if (level === "warning") {
    dotClass = "text-yellow-500"
    text = `${Math.floor(remaining_minutes / 60)}h`
    levelLabel = "Atenção"
  } else {
    dotClass = "text-green-500"
    levelLabel = "Dentro do prazo"
  }

  const exceededMins = Math.max(0, elapsed_minutes - resolution_minutes)

  const tooltipContent = (
    <div className="text-xs space-y-1">
      <p><span className="font-medium">SLA:</span> {levelLabel}</p>
      <p><span className="font-medium">Prioridade:</span> {getPriorityLabel(priority)}</p>
      {level === "expired"
        ? <p><span className="font-medium">Excedido há:</span> {formatMinutes(exceededMins)}</p>
        : <p><span className="font-medium">Restante:</span> {formatMinutes(remaining_minutes)}</p>
      }
    </div>
  )

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 text-xs cursor-default shrink-0">
            <span className={["text-base leading-none", dotClass].join(" ")}>●</span>
            {text && (
              <span className={["font-medium", dotClass].join(" ")}>{text}</span>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

interface SLABadgeProps {
  sla: SLAInfo | null | undefined
  compact?: boolean
}

export function SLABadge({ sla, compact = false }: SLABadgeProps) {
  if (!sla) return null

  if (compact) {
    return <SLABadgeCompact sla={sla} />
  }

  return <SLABadgeFull sla={sla} />
}

import { cn } from "@workspace/ui/lib/utils"

// ── Semantic color groups ────────────────────────────────────────────
const COLOR = {
  success: "bg-green-500/15 text-green-700 dark:text-green-400",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  error: "bg-red-500/15 text-red-700 dark:text-red-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  mild: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  neutral: "bg-muted text-muted-foreground",
} as const

// ── Status → semantic color mapping ──────────────────────────────────
const STATUS_COLORS: Record<string, string> = {
  // success
  active: COLOR.success,
  completed: COLOR.success,
  passing: COLOR.success,
  // active / running
  running: COLOR.active,
  in_progress: COLOR.active,
  resuming: COLOR.active,
  initializing: COLOR.active,
  // error
  failed: COLOR.error,
  failing: COLOR.error,
  // warning
  interrupted: COLOR.warning,
  blocked: COLOR.warning,
  // mild warning
  skipped: COLOR.mild,
}

// ── Display status derivation ────────────────────────────────────────
// Single source of truth: raw status + engine liveness → display label.
// "engineOn" means the engine PID is alive (truthy engine_pid).

export interface StatusContext {
  engineOn?: boolean
}

export function deriveDisplayStatus(
  raw: string | undefined,
  ctx: StatusContext = {},
): string {
  if (!raw) return "unknown"
  if (!ctx.engineOn) return raw

  if (raw === "interrupted") return "resuming"
  if (raw === "pending") return "initializing"
  return raw
}

// ── Component ────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  status?: string
  context?: StatusContext
  className?: string
}

export function StatusBadge({ status, context, className }: StatusBadgeProps) {
  const label = deriveDisplayStatus(status, context)
  const colorClass = STATUS_COLORS[label] ?? COLOR.neutral

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass,
        className,
      )}
    >
      {label}
    </span>
  )
}

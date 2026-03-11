interface StatusBadgeProps {
  status?: string
}

const STATUS_COLORS: Record<string, string> = {
  // success
  active: "bg-green-500/15 text-green-700 dark:text-green-400",
  completed: "bg-green-500/15 text-green-700 dark:text-green-400",
  passing: "bg-green-500/15 text-green-700 dark:text-green-400",
  // active/running
  running: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  // error
  failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  failing: "bg-red-500/15 text-red-700 dark:text-red-400",
  // warning
  interrupted: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  blocked: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  // mild warning
  skipped: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status ?? "unknown"
  const colorClass = STATUS_COLORS[label] ?? "bg-muted text-muted-foreground"

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  )
}

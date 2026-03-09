interface StatusBadgeProps {
  status?: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status ?? "unknown"
  const colorClass =
    label === "active"
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : label === "running"
        ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
        : label === "completed"
          ? "bg-green-500/15 text-green-700 dark:text-green-400"
          : label === "failed"
            ? "bg-red-500/15 text-red-700 dark:text-red-400"
            : "bg-muted text-muted-foreground"

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  )
}

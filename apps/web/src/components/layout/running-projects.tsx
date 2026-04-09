import { useEffect, useState, useCallback, useRef } from "react"
import { Link } from "@tanstack/react-router"
import { Play } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { apiFetch } from "@/lib/api"
import { useSSEContext } from "@/contexts/sse-context"

interface ActiveRun {
  slug: string
  name: string | null
  wave_number: number | null
  steps_completed: number
  steps_total: number
}

export function RunningProjects({ collapsed }: { collapsed: boolean }) {
  const [runs, setRuns] = useState<ActiveRun[]>([])
  const { subscribe, status } = useSSEContext()

  const lastFetchRef = useRef(0)

  const refresh = useCallback(() => {
    apiFetch("/api/v1/runs/active")
      .then((r) => r.json() as Promise<ActiveRun[]>)
      .then((data) => { lastFetchRef.current = Date.now(); setRuns(data) })
      .catch(() => undefined)
  }, [])

  // Throttled refresh for high-frequency events (engine:event)
  const throttledRefresh = useCallback(() => {
    if (Date.now() - lastFetchRef.current > 10_000) refresh()
  }, [refresh])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Refresh when SSE reconnects (catches events missed during disconnection)
  const prevStatusRef = useRef(status)
  useEffect(() => {
    const prev = prevStatusRef.current
    prevStatusRef.current = status
    if (status === "connected" && prev !== "connected") {
      refresh()
    }
  }, [status, refresh])

  // Refresh when tab becomes visible (catches externally-finished runs)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [refresh])

  // Refresh on run lifecycle events
  useEffect(() => {
    const unsubs = [
      subscribe("run:started", refresh),
      subscribe("run:completed", refresh),
      subscribe("run:failed", refresh),
      subscribe("engine:event", throttledRefresh),
    ]
    return () => unsubs.forEach((u) => u())
  }, [subscribe, refresh, throttledRefresh])

  if (runs.length === 0) return null

  return (
    <div className="border-t border-border px-2 py-2">
      <div className="flex max-h-32 flex-col gap-0.5 overflow-y-auto">
        {runs.map((run) => {
          const progress = run.steps_total > 0
            ? Math.round((run.steps_completed / run.steps_total) * 100)
            : 0
          const label = run.name || run.slug
          const tooltip = `${label} · ${progress}%`

          if (collapsed) {
            return (
              <Link
                key={run.slug}
                to="/projects/$slug/monitor"
                params={{ slug: run.slug }}
                title={tooltip}
                className="group flex items-center justify-center rounded-md px-2 py-1.5 transition-colors hover:bg-muted"
              >
                <CircularProgress progress={progress} />
              </Link>
            )
          }

          return (
            <Link
              key={run.slug}
              to="/projects/$slug/monitor"
              params={{ slug: run.slug }}
              title={tooltip}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted"
            >
              <PulsingPlay />
              <span className="flex-1 truncate text-muted-foreground">{label}</span>
              <span className="text-xs tabular-nums text-muted-foreground/70">{progress}%</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

/** Pulsing play icon for expanded mode */
function PulsingPlay() {
  return (
    <span className="relative flex size-4 items-center justify-center">
      <span className="absolute inset-0 animate-ping rounded-full bg-blue-500/30" />
      <Play className="relative size-3 fill-blue-500 text-blue-500" />
    </span>
  )
}

/** Circular progress ring with play icon inside for collapsed mode */
function CircularProgress({ progress }: { progress: number }) {
  const size = 24
  const strokeWidth = 2.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (progress / 100) * circumference

  return (
    <span className="relative flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/40"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-500 transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {/* Play icon centered */}
      <Play className="absolute size-2.5 fill-blue-500 text-blue-500 animate-pulse" />
    </span>
  )
}

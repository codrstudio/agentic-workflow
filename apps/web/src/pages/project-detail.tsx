import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Circle,
  Waves,
  Terminal,
  ListChecks,
  FileText,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
}

interface Run {
  id: string
  workflow: string
  status: "running" | "completed" | "failed"
  startedAt: string
}

type WaveStatus = "pending" | "running" | "completed" | "failed" | "interrupted"

interface Wave {
  wave_number: number
  status: WaveStatus
  steps_total: number
  steps_completed: number
  steps_failed: number
}

export function ProjectDetailPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug" })

  const [project, setProject] = useState<Project | null>(null)
  const [waves, setWaves] = useState<Wave[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}`).then((r) => r.json() as Promise<Project>),
      apiFetch(`/api/v1/projects/${slug}/waves`)
        .then((r) => (r.ok ? (r.json() as Promise<Wave[]>) : Promise.resolve([])))
        .catch(() => [] as Wave[]),
      apiFetch(`/api/v1/projects/${slug}/runs`)
        .then((r) => r.json() as Promise<Run[]>)
        .catch(() => [] as Run[]),
    ])
      .then(([p, w, r]) => {
        setProject(p)
        setWaves(w)
        setRuns(r)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-6">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-muted rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col p-6">
        <p className="text-destructive text-sm" role="alert">
          {error ?? "Projeto não encontrado"}
        </p>
      </div>
    )
  }

  const activeRuns = runs.filter((r) => r.status === "running")
  const totalWaves = waves.length
  const completedWaves = waves.filter((w) => w.status === "completed").length
  const runningWaves = waves.filter((w) => w.status === "running").length
  const failedWaves = waves.filter((w) => w.status === "failed").length

  return (
    <div className="flex flex-col p-6 gap-8 max-w-3xl">
      {/* Header */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </section>

      {/* Stats cards */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Waves</p>
          <p className="text-2xl font-bold tabular-nums">{totalWaves}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Completadas</p>
          <p className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">{completedWaves}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Em execução</p>
          <p className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">{runningWaves}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-xs text-muted-foreground mb-1">Falharam</p>
          <p className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">{failedWaves}</p>
        </div>
      </section>

      {/* Active runs summary */}
      {activeRuns.length > 0 && (
        <Link
          to="/projects/$slug/monitor"
          params={{ slug }}
          className="block bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 hover:bg-blue-500/20 transition-colors"
        >
          <div className="flex items-center mb-2">
            <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              {activeRuns.length} execução(ões) ativa(s)
            </h2>
          </div>
          <div className="flex flex-col gap-1">
            {activeRuns.map((run) => (
              <div key={run.id} className="flex items-center gap-2 text-xs">
                <StatusBadge status={run.status} />
                <span className="font-mono truncate">{run.workflow}</span>
              </div>
            ))}
          </div>
        </Link>
      )}

      {/* Quick links */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          to="/projects/$slug/waves"
          params={{ slug }}
          className="bg-card border rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
        >
          <Waves className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Waves</span>
          <span className="text-xs text-muted-foreground">{totalWaves} total</span>
        </Link>
        <Link
          to="/projects/$slug/console"
          params={{ slug }}
          className="bg-card border rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
        >
          <Terminal className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Console</span>
        </Link>
        <Link
          to="/projects/$slug/sprints"
          params={{ slug }}
          className="bg-card border rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
        >
          <ListChecks className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Sprints</span>
        </Link>
        <Link
          to="/projects/$slug/info"
          params={{ slug }}
          className="bg-card border rounded-lg p-4 flex flex-col items-center gap-2 hover:bg-muted/50 transition-colors"
        >
          <FileText className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm font-medium">Projeto</span>
        </Link>
      </section>

    </div>
  )
}

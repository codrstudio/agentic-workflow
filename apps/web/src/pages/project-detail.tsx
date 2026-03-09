import { useEffect, useState } from "react"
import { useParams } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
  workspace?: unknown
}

interface Workflow {
  slug: string
  name: string
  description?: string
}

interface Run {
  id: string
  slug: string
  workflow: string
  pid: number
  status: "running" | "completed" | "failed"
  startedAt: string
  completedAt?: string
  exitCode?: number
}

function formatDuration(startedAt: string, completedAt?: string): string {
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const seconds = Math.floor((end - start) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

export function ProjectDetailPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug" })

  const [project, setProject] = useState<Project | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedWorkflow, setSelectedWorkflow] = useState("")
  const [executing, setExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [stoppingIds, setStoppingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}`).then((r) => r.json() as Promise<Project>),
      apiFetch("/api/v1/workflows").then((r) => r.json() as Promise<Workflow[]>),
      apiFetch(`/api/v1/projects/${slug}/runs`).then((r) => r.json() as Promise<Run[]>),
    ])
      .then(([projectData, workflowData, runsData]) => {
        setProject(projectData)
        setWorkflows(workflowData)
        setRuns(runsData)
        if (workflowData.length > 0 && workflowData[0]) {
          setSelectedWorkflow(workflowData[0].slug)
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const refreshRuns = async () => {
    const runsData = await apiFetch(`/api/v1/projects/${slug}/runs`).then(
      (r) => r.json() as Promise<Run[]>,
    )
    setRuns(runsData)
  }

  const handleExecute = async () => {
    if (!selectedWorkflow) return
    setExecuting(true)
    setExecuteError(null)
    try {
      const res = await apiFetch(`/api/v1/projects/${slug}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: selectedWorkflow }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? "Failed to start run")
      }
      await refreshRuns()
    } catch (e: unknown) {
      setExecuteError(e instanceof Error ? e.message : "Failed to start run")
    } finally {
      setExecuting(false)
    }
  }

  const handleStop = async (runId: string) => {
    setStoppingIds((prev) => new Set(prev).add(runId))
    try {
      await apiFetch(`/api/v1/projects/${slug}/runs/${runId}`, {
        method: "DELETE",
      })
      await refreshRuns()
    } finally {
      setStoppingIds((prev) => {
        const next = new Set(prev)
        next.delete(runId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-6">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
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
  const finishedRuns = runs.filter((r) => r.status !== "running")

  return (
    <div className="flex flex-col p-6 gap-8 max-w-3xl">
      {/* Project info */}
      <section>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <StatusBadge status={project.status} />
        </div>
        <p className="text-muted-foreground text-xs font-mono mb-2">{project.slug}</p>
        {project.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}
      </section>

      {/* Execution form */}
      <section className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4">Executar Workflow</h2>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="workflow-select" className="text-xs text-muted-foreground">
              Workflow
            </label>
            <select
              id="workflow-select"
              value={selectedWorkflow}
              onChange={(e) => setSelectedWorkflow(e.target.value)}
              className="bg-background border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              disabled={workflows.length === 0 || executing}
            >
              {workflows.length === 0 ? (
                <option value="">Nenhum workflow disponível</option>
              ) : (
                workflows.map((wf) => (
                  <option key={wf.slug} value={wf.slug}>
                    {wf.name ?? wf.slug}
                  </option>
                ))
              )}
            </select>
          </div>

          {executeError && (
            <p className="text-destructive text-xs" role="alert">
              {executeError}
            </p>
          )}

          <button
            type="button"
            onClick={handleExecute}
            disabled={!selectedWorkflow || executing}
            className="self-start px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? "Iniciando..." : "Executar"}
          </button>
        </div>
      </section>

      {/* Active runs */}
      <section>
        <h2 className="text-sm font-semibold mb-3">
          Execuções Ativas
          {activeRuns.length > 0 && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({activeRuns.length})
            </span>
          )}
        </h2>
        {activeRuns.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma execução ativa.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {activeRuns.map((run) => (
              <div
                key={run.id}
                className="bg-card border rounded-lg px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={run.status} />
                    <span className="text-xs font-mono text-muted-foreground">
                      PID {run.pid}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDuration(run.startedAt)}
                    </span>
                  </div>
                  <span className="text-xs font-mono truncate">{run.workflow}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleStop(run.id)}
                  disabled={stoppingIds.has(run.id)}
                  className="shrink-0 px-3 py-1.5 rounded border text-xs font-medium hover:bg-destructive hover:text-destructive-foreground hover:border-destructive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {stoppingIds.has(run.id) ? "Parando..." : "Parar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Finished runs */}
      {finishedRuns.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
            Histórico
          </h2>
          <div className="flex flex-col gap-2">
            {finishedRuns.map((run) => (
              <div
                key={run.id}
                className="bg-card border rounded-lg px-4 py-3 flex items-center gap-4"
              >
                <StatusBadge status={run.status} />
                <span className="text-xs font-mono text-muted-foreground">
                  PID {run.pid}
                </span>
                <span className="text-xs font-mono truncate text-muted-foreground">
                  {run.workflow}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatDuration(run.startedAt, run.completedAt)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

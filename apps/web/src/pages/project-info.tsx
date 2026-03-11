import { useEffect, useState } from "react"
import { useParams } from "@tanstack/react-router"
import { Loader2, Play } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
  params?: Record<string, string>
  source_folder?: string
  target_folder?: string
}

interface Workflow {
  slug: string
  name: string
  description?: string
  steps?: unknown[]
}

interface Run {
  id: string
  workflow: string
  status: "running" | "completed" | "failed"
}

export function ProjectInfoPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/info" })

  const [project, setProject] = useState<Project | null>(null)
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [activeRuns, setActiveRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [executingWf, setExecutingWf] = useState<string | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}`).then((r) => r.json() as Promise<Project>),
      apiFetch("/api/v1/workflows").then((r) => r.json() as Promise<Workflow[]>),
      apiFetch(`/api/v1/projects/${slug}/runs`).then((r) => r.json() as Promise<Run[]>),
    ])
      .then(([p, w, r]) => {
        setProject(p)
        setWorkflows(w)
        setActiveRuns(r.filter((run) => run.status === "running"))
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const handleExecute = async (workflowSlug: string) => {
    setExecutingWf(workflowSlug)
    setExecuteError(null)
    try {
      const res = await apiFetch(`/api/v1/projects/${slug}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: workflowSlug }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? "Failed to start run")
      }
      // Refresh runs
      const runsData = await apiFetch(`/api/v1/projects/${slug}/runs`).then(
        (r) => r.json() as Promise<Run[]>,
      )
      setActiveRuns(runsData.filter((run) => run.status === "running"))
    } catch (e: unknown) {
      setExecuteError(e instanceof Error ? e.message : "Failed to start run")
    } finally {
      setExecutingWf(null)
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

  return (
    <div className="flex flex-col p-6 gap-8 max-w-3xl">
      {/* Project details */}
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

      {/* Metadata */}
      {(project.source_folder || project.target_folder || project.params) && (
        <section className="bg-card border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Metadata</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {project.source_folder && (
              <>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-mono text-xs">{project.source_folder}</dd>
              </>
            )}
            {project.target_folder && (
              <>
                <dt className="text-muted-foreground">Target</dt>
                <dd className="font-mono text-xs">{project.target_folder}</dd>
              </>
            )}
            {project.params && Object.entries(project.params).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-mono text-xs">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Workflow cards */}
      <section>
        <h2 className="text-sm font-semibold mb-4">Workflows</h2>
        {executeError && (
          <p className="text-destructive text-xs mb-3" role="alert">{executeError}</p>
        )}
        {workflows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum workflow disponível.</p>
        ) : (
          <div className="grid gap-3">
            {workflows.map((wf) => {
              const isRunning = activeRuns.some((r) => r.workflow === wf.slug)
              const isExecuting = executingWf === wf.slug
              return (
                <div
                  key={wf.slug}
                  className={`bg-card border rounded-lg p-4 flex items-start gap-4 ${
                    isRunning ? "border-blue-500/40 bg-blue-500/5" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium">{wf.name ?? wf.slug}</h3>
                      {isRunning && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Em execução
                        </span>
                      )}
                    </div>
                    {wf.description && (
                      <p className="text-xs text-muted-foreground mb-1">{wf.description}</p>
                    )}
                    {wf.steps && (
                      <p className="text-xs text-muted-foreground">
                        {wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleExecute(wf.slug)}
                    disabled={isExecuting}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isExecuting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    Executar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

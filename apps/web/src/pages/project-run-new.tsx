import { useEffect, useState } from "react"
import { useParams, useNavigate, Link } from "@tanstack/react-router"
import { Loader2, Play } from "lucide-react"
import { apiFetch } from "@/lib/api"

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

export function ProjectRunNewPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/runs/new" })
  const navigate = useNavigate()

  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [activeRuns, setActiveRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedWf, setSelectedWf] = useState<string | null>(null)
  const [executing, setExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setLoadError(null)
    Promise.all([
      apiFetch("/api/v1/workflows").then((r) => r.json() as Promise<Workflow[]>),
      apiFetch(`/api/v1/projects/${slug}/runs`).then((r) => r.json() as Promise<Run[]>),
    ])
      .then(([w, r]) => {
        setWorkflows(w)
        setActiveRuns(r.filter((run) => run.status === "running"))
      })
      .catch((e: Error) => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const handleExecute = async () => {
    if (!selectedWf) return
    setExecuting(true)
    setExecuteError(null)
    try {
      const res = await apiFetch(`/api/v1/projects/${slug}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: selectedWf }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? "Failed to start run")
      }
      void navigate({ to: "/projects/$slug/waves", params: { slug } })
    } catch (e: unknown) {
      setExecuteError(e instanceof Error ? e.message : "Failed to start run")
      setExecuting(false)
    }
  }

  return (
    <div className="flex flex-col p-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        <Link
          to="/projects/$slug/info"
          params={{ slug }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Info
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="font-semibold">Nova Execução</h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
          <div className="h-16 bg-muted rounded-lg animate-pulse" />
        </div>
      ) : loadError ? (
        <p className="text-destructive text-sm" role="alert">{loadError}</p>
      ) : workflows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum workflow disponível.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {workflows.map((wf) => {
            const isRunning = activeRuns.some((r) => r.workflow === wf.slug)
            const isSelected = selectedWf === wf.slug
            return (
              <div
                key={wf.slug}
                onClick={() => setSelectedWf(wf.slug)}
                className={`bg-card border rounded-lg p-4 flex items-start gap-4 cursor-pointer transition-colors ${
                  isSelected
                    ? "border-primary ring-1 ring-primary"
                    : isRunning
                      ? "border-blue-500/40 bg-blue-500/5"
                      : "hover:border-muted-foreground/30"
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
                    <p className="text-xs text-muted-foreground">{wf.description}</p>
                  )}
                  {wf.steps && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {wf.steps.length} step{wf.steps.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col gap-2 mt-6">
        {executeError && (
          <p className="text-destructive text-xs" role="alert">{executeError}</p>
        )}
        <div className="flex gap-2 justify-end">
          <Link
            to="/projects/$slug/info"
            params={{ slug }}
            className="px-3 py-1.5 rounded-md text-sm border hover:bg-muted transition-colors"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleExecute}
            disabled={!selectedWf || executing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Executar
          </button>
        </div>
      </div>
    </div>
  )
}

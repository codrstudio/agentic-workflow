import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate } from "@tanstack/react-router"
import { Loader2, Play, X } from "lucide-react"
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

  const dialogRef = useRef<HTMLDivElement>(null)

  const handleClose = () => {
    void navigate({ to: "/projects/$slug/info", params: { slug } })
  }

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [slug])

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

  const [queued, setQueued] = useState(false)

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
      if (res.status === 202) {
        setQueued(true)
        setExecuting(false)
        return
      }
      void navigate({ to: "/projects/$slug/waves", params: { slug } })
    } catch (e: unknown) {
      setExecuteError(e instanceof Error ? e.message : "Failed to start run")
      setExecuting(false)
    }
  }

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Nova Execução"
        className="relative w-full max-w-lg mx-4 my-8 max-h-[calc(100vh-4rem)] bg-card border rounded-xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b">
          <h2 className="text-sm font-semibold">Nova Execução</h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3 min-h-[120px] overflow-y-auto">
          {loading ? (
            <>
              <div className="h-14 bg-muted rounded-lg animate-pulse" />
              <div className="h-14 bg-muted rounded-lg animate-pulse" />
              <div className="h-14 bg-muted rounded-lg animate-pulse" />
            </>
          ) : loadError ? (
            <p className="text-destructive text-sm" role="alert">{loadError}</p>
          ) : workflows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum workflow disponível.</p>
          ) : (
            workflows.map((wf) => {
              const isRunning = activeRuns.some((r) => r.workflow === wf.slug)
              const isSelected = selectedWf === wf.slug
              return (
                <div
                  key={wf.slug}
                  onClick={() => setSelectedWf(wf.slug)}
                  className={`border rounded-lg p-3.5 flex items-start gap-4 cursor-pointer transition-colors ${
                    isSelected
                      ? "border-primary ring-1 ring-primary bg-primary/5"
                      : isRunning
                        ? "border-blue-500/40 bg-blue-500/5"
                        : "hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
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
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t flex flex-col gap-2">
          {executeError && (
            <p className="text-destructive text-xs" role="alert">{executeError}</p>
          )}
          {queued && (
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Execução enfileirada. Será iniciada quando a execução atual terminar.
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 rounded-md text-sm border hover:bg-muted transition-colors"
            >
              {queued ? "Fechar" : "Cancelar"}
            </button>
            {!queued && (
              <button
                type="button"
                onClick={handleExecute}
                disabled={!selectedWf || executing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {executing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                {activeRuns.length > 0 ? "Enfileirar" : "Executar"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate } from "@tanstack/react-router"
import { Loader2, Play, X, ChevronRight, ChevronLeft, Link2 } from "lucide-react"
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

interface ProjectSummary {
  slug: string
  name: string
}

type TriggerMode = "immediate" | "after-project"

export function ProjectRunNewPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/runs/new" })
  const navigate = useNavigate()

  // Step state
  const [step, setStep] = useState<1 | 2>(1)

  // Step 1 data
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [activeRuns, setActiveRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedWf, setSelectedWf] = useState<string | null>(null)

  // Step 2 data
  const [triggerMode, setTriggerMode] = useState<TriggerMode>("immediate")
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [sourceSlug, setSourceSlug] = useState(slug)
  const [sourceWorkflow, setSourceWorkflow] = useState("")

  // Submit state
  const [executing, setExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)
  const [triggered, setTriggered] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)

  const handleClose = () => {
    void navigate({ to: "/projects/$slug/info", params: { slug } })
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [slug])

  // Load workflows + active runs
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

  // Load projects when entering step 2
  useEffect(() => {
    if (step !== 2 || projects.length > 0) return
    apiFetch("/api/v1/projects?limit=100")
      .then((r) => r.json() as Promise<{ projects: ProjectSummary[] }>)
      .then((data) => setProjects(data.projects))
      .catch(() => {})
  }, [step, projects.length])

  const handleConfirm = async () => {
    if (!selectedWf) return
    setExecuting(true)
    setExecuteError(null)

    try {
      if (triggerMode === "after-project") {
        // Create a trigger
        const res = await apiFetch("/api/v1/triggers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetSlug: slug,
            targetWorkflow: selectedWf,
            sourceSlug,
            sourceWorkflow: sourceWorkflow || undefined,
          }),
        })
        if (!res.ok) {
          const body = (await res.json()) as { error?: string }
          throw new Error(body.error ?? "Failed to create trigger")
        }
        setTriggered(true)
        setExecuting(false)
        return
      }

      // Immediate execution
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
      setExecuteError(e instanceof Error ? e.message : "Failed")
      setExecuting(false)
    }
  }

  const done = queued || triggered

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose()
      }}
    >
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

        {/* Step indicator */}
        <div className="px-5 pt-4 pb-2 flex items-center gap-2 text-xs">
          <span className={step === 1 ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {step === 1 ? "●" : "○"} Workflow
          </span>
          <span className="text-muted-foreground">────</span>
          <span className={step === 2 ? "font-semibold text-foreground" : "text-muted-foreground"}>
            {step === 2 ? "●" : "○"} Encadeamento
          </span>
        </div>

        {/* Body */}
        <div className="px-5 py-3 flex flex-col gap-3 min-h-[140px] overflow-y-auto">
          {step === 1 && (
            <>
              {loading ? (
                <>
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
            </>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">Quando iniciar?</p>

              {/* Immediate */}
              <label
                className={`border rounded-lg p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                  triggerMode === "immediate" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="trigger"
                  checked={triggerMode === "immediate"}
                  onChange={() => setTriggerMode("immediate")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Imediatamente</p>
                  <p className="text-xs text-muted-foreground">
                    {activeRuns.length > 0
                      ? "Enfileira (já há execução ativa neste projeto)"
                      : "Inicia agora"}
                  </p>
                </div>
              </label>

              {/* After project */}
              <label
                className={`border rounded-lg p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                  triggerMode === "after-project" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="trigger"
                  checked={triggerMode === "after-project"}
                  onChange={() => setTriggerMode("after-project")}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">Após conclusão de outro projeto</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Inicia automaticamente quando o projeto fonte completar
                  </p>
                </div>
              </label>

              {triggerMode === "after-project" && (
                <div className="pl-7 flex flex-col gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Projeto fonte</label>
                    <select
                      value={sourceSlug}
                      onChange={(e) => setSourceSlug(e.target.value)}
                      className="w-full bg-background border rounded-md px-3 py-1.5 text-sm"
                    >
                      {projects.map((p) => (
                        <option key={p.slug} value={p.slug}>
                          {p.name} ({p.slug})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Workflow fonte <span className="text-muted-foreground/60">(opcional)</span>
                    </label>
                    <select
                      value={sourceWorkflow}
                      onChange={(e) => setSourceWorkflow(e.target.value)}
                      className="w-full bg-background border rounded-md px-3 py-1.5 text-sm"
                    >
                      <option value="">Qualquer workflow</option>
                      {workflows.map((wf) => (
                        <option key={wf.slug} value={wf.slug}>
                          {wf.name ?? wf.slug}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
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
          {triggered && (
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Trigger criado. A execução será iniciada quando o projeto fonte completar.
            </p>
          )}
          <div className="flex gap-2 justify-between">
            <div>
              {step === 2 && !done && (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border hover:bg-muted transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-md text-sm border hover:bg-muted transition-colors"
              >
                {done ? "Fechar" : "Cancelar"}
              </button>
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!selectedWf}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próximo
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
              {step === 2 && !done && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={executing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {executing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : triggerMode === "after-project" ? (
                    <Link2 className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {triggerMode === "after-project"
                    ? "Criar Trigger"
                    : activeRuns.length > 0
                      ? "Enfileirar"
                      : "Executar"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

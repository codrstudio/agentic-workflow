import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useParams, useNavigate } from "@tanstack/react-router"
import { Loader2, Play, X, ChevronRight, ChevronLeft, Link2, Clock } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface Workflow {
  slug: string
  name: string
  description?: string
  steps?: unknown[]
}

interface Run {
  id: string
  slug: string
  workflow: string
  status: "running" | "completed" | "failed"
  startedAt?: string
}

interface QueuedRun {
  id: string
  slug: string
  workflow: string
  queuedAt: string
  dependsOn?: RunDependency
}

type RunDependency =
  | { type: "specific-run"; runId: string }
  | { type: "project-completion"; sourceSlug: string }

interface ProjectSummary {
  slug: string
  name: string
}

type DependencyMode = "immediate" | "specific-run" | "project-completion"

export function ProjectRunNewPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/runs/new" })
  const navigate = useNavigate()

  const [step, setStep] = useState<1 | 2>(1)

  // Step 1
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [activeRuns, setActiveRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedWf, setSelectedWf] = useState<string | null>(null)

  // Step 2
  const [depMode, setDepMode] = useState<DependencyMode>("immediate")
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [allActiveRuns, setAllActiveRuns] = useState<Run[]>([])
  const [allQueuedRuns, setAllQueuedRuns] = useState<QueuedRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [sourceSlug, setSourceSlug] = useState(slug)

  // Submit
  const [executing, setExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)
  const [queued, setQueued] = useState(false)

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

  // Load workflows + active runs for this project
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

  // Load projects + all active/queued runs when entering step 2
  useEffect(() => {
    if (step !== 2) return
    Promise.all([
      apiFetch("/api/v1/projects?limit=100")
        .then((r) => r.json() as Promise<{ projects: ProjectSummary[] }>)
        .then((data) => data.projects),
      apiFetch("/api/v1/runs/all")
        .then((r) => r.json() as Promise<Run[]>)
        .then((runs) => runs.filter((r) => r.status === "running"))
        .catch(() => [] as Run[]),
    ]).then(([projs, runs]) => {
      setProjects(projs)
      setAllActiveRuns(runs)
      // Load queued runs for all projects
      Promise.all(
        projs.map((p) =>
          apiFetch(`/api/v1/projects/${p.slug}/runs/queue`)
            .then((r) => r.ok ? r.json() as Promise<QueuedRun[]> : [])
            .catch(() => [] as QueuedRun[])
        )
      ).then((queues) => {
        setAllQueuedRuns(queues.flat())
      }).catch(() => {})
    }).catch(() => {})
  }, [step])

  const handleConfirm = async () => {
    if (!selectedWf) return
    setExecuting(true)
    setExecuteError(null)

    try {
      let dependsOn: RunDependency | undefined

      if (depMode === "specific-run" && selectedRunId) {
        dependsOn = { type: "specific-run", runId: selectedRunId }
      } else if (depMode === "project-completion" && sourceSlug) {
        dependsOn = { type: "project-completion", sourceSlug }
      }

      const res = await apiFetch(`/api/v1/projects/${slug}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow: selectedWf, dependsOn }),
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

  // Runs available as dependency targets (active + queued, all projects)
  const dependableRuns = [
    ...allActiveRuns.map((r) => ({
      id: r.id,
      slug: r.slug,
      workflow: r.workflow,
      label: `${r.slug} — ${r.workflow}`,
      kind: "running" as const,
    })),
    ...allQueuedRuns.map((q) => ({
      id: q.id,
      slug: q.slug,
      workflow: q.workflow,
      label: `${q.slug} — ${q.workflow}`,
      kind: "queued" as const,
    })),
  ]

  const done = queued

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
            {step === 2 ? "●" : "○"} Dependência
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
                  depMode === "immediate" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="dep"
                  checked={depMode === "immediate"}
                  onChange={() => setDepMode("immediate")}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Próxima na fila</p>
                  <p className="text-xs text-muted-foreground">
                    {activeRuns.length > 0
                      ? "Enfileira (já há execução ativa neste projeto)"
                      : "Inicia agora"}
                  </p>
                </div>
              </label>

              {/* After specific run */}
              <label
                className={`border rounded-lg p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                  depMode === "specific-run" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="dep"
                  checked={depMode === "specific-run"}
                  onChange={() => setDepMode("specific-run")}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">Após execução específica</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inicia quando uma execução em andamento ou enfileirada completar
                  </p>
                </div>
              </label>

              {depMode === "specific-run" && (
                <div className="pl-7 flex flex-col gap-2">
                  {dependableRuns.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma execução ativa ou enfileirada.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                      {dependableRuns.map((r) => (
                        <label
                          key={r.id}
                          className={`border rounded-md px-3 py-2 flex items-center gap-2 cursor-pointer transition-colors text-sm ${
                            selectedRunId === r.id
                              ? "border-primary ring-1 ring-primary bg-primary/5"
                              : "hover:border-muted-foreground/30"
                          }`}
                        >
                          <input
                            type="radio"
                            name="depRun"
                            checked={selectedRunId === r.id}
                            onChange={() => setSelectedRunId(r.id)}
                          />
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {r.kind === "running" ? (
                              <Loader2 className="w-3 h-3 text-blue-500 animate-spin shrink-0" />
                            ) : (
                              <Clock className="w-3 h-3 text-amber-500 shrink-0" />
                            )}
                            <span className="truncate font-mono text-xs">{r.label}</span>
                            <span className={`text-[10px] px-1 py-0.5 rounded shrink-0 ${
                              r.kind === "running"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}>
                              {r.kind === "running" ? "executando" : "na fila"}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* After any project completion */}
              <label
                className={`border rounded-lg p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                  depMode === "project-completion" ? "border-primary ring-1 ring-primary bg-primary/5" : "hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="dep"
                  checked={depMode === "project-completion"}
                  onChange={() => setDepMode("project-completion")}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-medium">Após conclusão de projeto</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Inicia quando qualquer execução do projeto fonte completar
                  </p>
                </div>
              </label>

              {depMode === "project-completion" && (
                <div className="pl-7">
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
              {depMode === "immediate"
                ? "Execução enfileirada. Será iniciada quando a execução atual terminar."
                : depMode === "specific-run"
                  ? "Execução enfileirada. Será iniciada quando a execução selecionada completar."
                  : "Execução enfileirada. Será iniciada quando o projeto fonte completar."}
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
                  disabled={executing || (depMode === "specific-run" && !selectedRunId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {executing ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : depMode !== "immediate" ? (
                    <Link2 className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  {depMode !== "immediate"
                    ? "Enfileirar"
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

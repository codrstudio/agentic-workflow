import { useEffect, useState } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { Loader2, Play, ChevronRight, ChevronLeft, Link2, Clock, Eye, EyeOff, SkipForward } from "lucide-react"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"
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
  prompt?: string
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

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [activeRuns, setActiveRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedWf, setSelectedWf] = useState<string | null>(null)

  // Step 2 — Prompt
  const [prompt, setPrompt] = useState("")
  const [showPreview, setShowPreview] = useState(false)

  // Step 3 — Dependency
  const [depMode, setDepMode] = useState<DependencyMode>("immediate")
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [allActiveRuns, setAllActiveRuns] = useState<Run[]>([])
  const [allQueuedRuns, setAllQueuedRuns] = useState<QueuedRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [sourceSlug, setSourceSlug] = useState(slug)

  // Submit
  const [executing, setExecuting] = useState(false)
  const [executeError, setExecuteError] = useState<string | null>(null)

  const handleClose = () => {
    void navigate({ to: "/projects/$slug/waves", params: { slug } })
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

  // Load projects + all active/queued runs when entering step 3
  useEffect(() => {
    if (step !== 3) return
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
        body: JSON.stringify({
          workflow: selectedWf,
          ...(prompt.trim() ? { prompt: prompt.trim() } : {}),
          dependsOn,
        }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? "Failed to start run")
      }
      void navigate({ to: "/projects/$slug/waves", params: { slug } })
    } catch (e: unknown) {
      setExecuteError(e instanceof Error ? e.message : "Failed")
      setExecuting(false)
    }
  }

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

  const stepLabels = [
    { n: 1, label: "Prompt" },
    { n: 2, label: "Workflow" },
    { n: 3, label: "Dependência" },
  ] as const

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">
          Nova Execução — <span className="font-mono text-muted-foreground">{slug}</span>
        </h1>
        <button
          type="button"
          onClick={handleClose}
          className="px-3 py-1.5 rounded-md text-sm border hover:bg-muted"
        >
          Cancelar
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-xs">
        {stepLabels.map(({ n, label }, i) => (
          <span key={n} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">────</span>}
            <span className={step === n ? "font-semibold text-foreground" : "text-muted-foreground"}>
              {step === n ? "●" : step > n ? "✓" : "○"} {label}
            </span>
          </span>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 overflow-y-auto">
        {/* Step 2: Workflow selection */}
        {step === 2 && (
          <div className="max-w-lg flex flex-col gap-3">
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
          </div>
        )}

        {/* Step 1: Prompt editor */}
        {step === 1 && (
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPreview((p) => !p)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? "Ocultar preview" : "Mostrar preview"}
              </button>
              <span className="text-xs text-muted-foreground">
                Descreva o que esta wave deve fazer (opcional)
              </span>
            </div>
            <div className={`flex-1 grid min-h-0 gap-4 ${showPreview ? "grid-cols-2" : "grid-cols-1"}`}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Descreva o objetivo desta execução..."
                className="min-h-0 w-full resize-none overflow-y-auto rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                spellCheck={false}
                autoFocus
              />
              {showPreview && (
                <div className="min-h-0 overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
                  {prompt.trim() ? (
                    <MarkdownViewer content={prompt} />
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Nenhum conteúdo para preview</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Dependency */}
        {step === 3 && (
          <div className="max-w-lg flex flex-col gap-4">
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

            {/* After project completion */}
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
      <div className="flex flex-col gap-2 border-t pt-3">
        {executeError && (
          <p className="text-destructive text-xs" role="alert">{executeError}</p>
        )}
        <div className="flex gap-2 justify-between">
          <div>
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}
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
              Cancelar
            </button>

            {/* Step 1 (Prompt) → Step 2 */}
            {step === 1 && (
              <>
                <button
                  type="button"
                  onClick={() => { setPrompt(""); setStep(2) }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md text-sm border hover:bg-muted transition-colors text-muted-foreground"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Pular
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  Próximo
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {/* Step 2 (Workflow) → Step 3 */}
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!selectedWf}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Próximo
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Step 3: confirm */}
            {step === 3 && (
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
  )
}

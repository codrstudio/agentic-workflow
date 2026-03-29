import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useSearch, useNavigate } from "@tanstack/react-router"
import {
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  AlertTriangle,
  ChevronDown,
  FileText,
  Hash,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface Feature {
  id: string
  title?: string
  name?: string
  description?: string
  status: "passing" | "failing" | "skipped" | "pending" | "blocked" | "in_progress"
  priority?: number
  depends_on?: string[]
  dependencies?: string[]
  tests?: string[]
  prp_filename?: string
  completed_at?: string
  agent?: string
  task?: string
}

interface LoopData {
  loop: {
    status?: string
    iteration?: number
    total?: number
    done?: number
    remaining?: number
    features_done?: number
    exit_reason?: string
  } | null
  features: Feature[]
  counters: {
    passing: number
    failing: number
    skipped: number
    pending: number
    blocked: number
    in_progress: number
  }
}

interface SprintFile {
  filename: string
  size: number
}

interface SprintFiles {
  sprint: string
  specs: SprintFile[]
  prps: SprintFile[]
}

type TabId = "features" | "specs" | "prps" | "task"

function FeatureStatusIcon({ status }: { status: Feature["status"] }) {
  if (status === "passing") return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
  if (status === "failing") return <XCircle className="w-4 h-4 text-red-500 shrink-0" />
  if (status === "in_progress") return <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
  if (status === "blocked") return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
  if (status === "skipped") return <Circle className="w-4 h-4 text-muted-foreground/60 shrink-0" />
  return <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
}

const STATUS_BADGE: Record<Feature["status"], string> = {
  passing: "bg-green-500/15 text-green-700 dark:text-green-400",
  failing: "bg-red-500/15 text-red-700 dark:text-red-400",
  in_progress: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  blocked: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  skipped: "bg-muted text-muted-foreground",
  pending: "bg-muted text-muted-foreground",
}

function FeatureCard({
  feature,
  onScrollToFeature,
}: {
  feature: Feature
  onScrollToFeature: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [prpContent, setPrpContent] = useState<string | null>(null)
  const [prpLoading, setPrpLoading] = useState(false)
  const { slug, waveNumber } = useParams({
    from: "/_auth/projects/$slug/sprints/$waveNumber",
  })

  const deps = feature.depends_on ?? feature.dependencies ?? []
  const description = feature.description ?? ""
  const tests = feature.tests ?? []

  const loadPrp = useCallback(() => {
    if (!feature.prp_filename || prpContent !== null) return
    setPrpLoading(true)
    apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}/sprint/files/${feature.prp_filename}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load PRP")
        return r.json() as Promise<{ filename: string; content: string }>
      })
      .then((data) => setPrpContent(data.content))
      .catch(() => setPrpContent("_Erro ao carregar PRP._"))
      .finally(() => setPrpLoading(false))
  }, [feature.prp_filename, prpContent, slug, waveNumber])

  return (
    <div
      id={`feature-${feature.id}`}
      className="rounded-lg border border-border overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <FeatureStatusIcon status={feature.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-mono font-medium">{feature.id}</span>
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_BADGE[feature.status]}`}
            >
              {feature.status}
            </span>
            {feature.priority !== undefined && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Hash className="w-2.5 h-2.5" />
                {feature.priority}
              </span>
            )}
          </div>
          {(feature.title ?? feature.name) && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {feature.title ?? feature.name}
            </p>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border space-y-3">
          {description && (
            <p className="text-sm text-foreground/85">{description}</p>
          )}

          {tests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Testes de aceite
              </p>
              <ul className="space-y-1">
                {tests.map((test, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {feature.status === "passing" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />
                    )}
                    <span className="text-foreground/80">{test}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deps.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Dependências
              </p>
              <div className="flex flex-wrap gap-1">
                {deps.map((dep) => (
                  <button
                    key={dep}
                    type="button"
                    onClick={() => onScrollToFeature(dep)}
                    className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                  >
                    {dep}
                  </button>
                ))}
              </div>
            </div>
          )}

          {feature.prp_filename && (
            <div>
              <button
                type="button"
                onClick={loadPrp}
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <FileText className="w-3.5 h-3.5" />
                {prpContent !== null ? "PRP carregado" : "Ver PRP"}
              </button>
              {prpLoading && (
                <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin mt-2" />
              )}
              {prpContent !== null && !prpLoading && (
                <div className="mt-2 rounded-md border border-border p-4 bg-card">
                  <MarkdownViewer content={prpContent} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FileAccordion({
  files,
  slug,
  waveNumber,
}: {
  files: SprintFile[]
  slug: string
  waveNumber: string
}) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [contents, setContents] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState<string | null>(null)

  const toggleFile = useCallback(
    (filename: string) => {
      if (expandedFile === filename) {
        setExpandedFile(null)
        return
      }
      setExpandedFile(filename)
      if (!contents[filename]) {
        setLoading(filename)
        apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}/sprint/files/${filename}`)
          .then((r) => {
            if (!r.ok) throw new Error("Failed")
            return r.json() as Promise<{ filename: string; content: string }>
          })
          .then((data) =>
            setContents((prev) => ({ ...prev, [filename]: data.content }))
          )
          .catch(() =>
            setContents((prev) => ({
              ...prev,
              [filename]: "_Erro ao carregar arquivo._",
            }))
          )
          .finally(() => setLoading(null))
      }
    },
    [expandedFile, contents, slug, waveNumber]
  )

  if (files.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Nenhum arquivo encontrado.</p>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      {files.map((f) => (
        <div key={f.filename} className="rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => toggleFile(f.filename)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
          >
            <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-mono truncate block">{f.filename}</span>
              <span className="text-[10px] text-muted-foreground">
                {(f.size / 1024).toFixed(1)} KB
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${expandedFile === f.filename ? "rotate-180" : ""}`}
            />
          </button>
          {expandedFile === f.filename && (
            <div className="px-4 pb-4 pt-1 border-t border-border">
              {loading === f.filename ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Carregando...</span>
                </div>
              ) : contents[f.filename] ? (
                <MarkdownViewer content={contents[f.filename]} />
              ) : null}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export function WaveSprintsPage() {
  const { slug, waveNumber } = useParams({
    from: "/_auth/projects/$slug/sprints/$waveNumber",
  })

  const { tab } = useSearch({ from: "/_auth/projects/$slug/sprints/$waveNumber" })
  const navigate = useNavigate()
  const activeTab: TabId = (["features", "specs", "prps", "task"].includes(tab ?? "") ? tab as TabId : "features")
  const setActiveTab = (id: TabId) => {
    navigate({ search: { tab: id === "features" ? undefined : id }, replace: true })
  }

  const [data, setData] = useState<LoopData | null>(null)
  const [sprintFiles, setSprintFiles] = useState<SprintFiles | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskContent, setTaskContent] = useState<string | null>(null)
  const [taskNotFound, setTaskNotFound] = useState(false)
  const [taskLoading, setTaskLoading] = useState(false)
  const taskFetched = useRef(false)
  const featuresRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}/loop`)
        .then((r) => {
          if (!r.ok) return null
          return r.json() as Promise<LoopData>
        })
        .catch(() => null),
      apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}/sprint/files`)
        .then((r) => (r.ok ? (r.json() as Promise<SprintFiles>) : null))
        .catch(() => null),
    ])
      .then(([loopData, filesData]) => {
        if (!loopData && !filesData) {
          setError("Nenhum sprint ou loop encontrado nesta wave.")
          return
        }
        setData(loopData ?? { loop: null, features: [], counters: { passing: 0, failing: 0, skipped: 0, pending: 0, blocked: 0, in_progress: 0 } })
        setSprintFiles(filesData)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug, waveNumber])

  const loadTask = useCallback(() => {
    if (taskFetched.current) return
    taskFetched.current = true
    setTaskLoading(true)
    apiFetch(`/api/v1/projects/${slug}/waves/${waveNumber}/sprint/task`)
      .then((r) => {
        if (r.status === 404) { setTaskNotFound(true); return null }
        if (!r.ok) throw new Error("Failed")
        return r.json() as Promise<{ content: string }>
      })
      .then((data) => { if (data) setTaskContent(data.content) })
      .catch(() => setTaskNotFound(true))
      .finally(() => setTaskLoading(false))
  }, [slug, waveNumber])

  useEffect(() => {
    if (activeTab === "task") loadTask()
  }, [activeTab, loadTask])

  const scrollToFeature = useCallback((id: string) => {
    const el = document.getElementById(`feature-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.classList.add("ring-2", "ring-primary")
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-4">
        <div className="h-5 bg-muted rounded w-1/4 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col p-6">
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    )
  }

  if (!data) return null

  const { features, counters, loop } = data
  const total = features.length

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: "features", label: "Features", count: total },
    { id: "specs", label: "Specs", count: sprintFiles?.specs.length ?? 0 },
    { id: "prps", label: "PRPs", count: sprintFiles?.prps.length ?? 0 },
    { id: "task", label: "Task" },
  ]

  return (
    <div className="flex flex-col p-6 gap-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold capitalize">
          {sprintFiles?.sprint ? sprintFiles.sprint.replace('-', ' ') : `Sprint`}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Wave {waveNumber}
          {loop && (
            <span>
              {" · "}
              {loop.status === "exited"
                ? `Loop finalizado — ${loop.exit_reason ?? "concluído"}`
                : `Iteração ${loop.iteration ?? "?"} · ${loop.done ?? 0} features concluídas`}
            </span>
          )}
        </p>
      </div>

      {/* Counter badges */}
      <div className="flex flex-wrap gap-2">
        {counters.passing > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2.5 py-1 text-xs font-medium text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-3 h-3" /> {counters.passing} passing
          </span>
        )}
        {counters.failing > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400">
            <XCircle className="w-3 h-3" /> {counters.failing} failing
          </span>
        )}
        {counters.in_progress > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" /> {counters.in_progress} in progress
          </span>
        )}
        {counters.blocked > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" /> {counters.blocked} blocked
          </span>
        )}
        {counters.skipped > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {counters.skipped} skipped
          </span>
        )}
        {counters.pending > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            {counters.pending} pending
          </span>
        )}
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {total} total
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs text-muted-foreground">({tab.count})</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "features" && (
        <div ref={featuresRef} className="flex flex-col gap-1">
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma feature encontrada.</p>
          ) : (
            features.map((f) => (
              <FeatureCard
                key={f.id}
                feature={f}
                onScrollToFeature={scrollToFeature}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "specs" && sprintFiles && (
        <FileAccordion
          files={sprintFiles.specs}
          slug={slug}
          waveNumber={waveNumber}
        />
      )}

      {activeTab === "prps" && sprintFiles && (
        <FileAccordion
          files={sprintFiles.prps}
          slug={slug}
          waveNumber={waveNumber}
        />
      )}

      {activeTab === "task" && (
        taskLoading ? (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando...</span>
          </div>
        ) : taskNotFound ? (
          <div className="rounded-lg border border-border p-6 text-center">
            <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">TASK.md não encontrado neste sprint.</p>
          </div>
        ) : taskContent ? (
          <div className="rounded-lg border border-border p-4 bg-card">
            <MarkdownViewer content={taskContent} />
          </div>
        ) : null
      )}

      {(activeTab === "specs" || activeTab === "prps") && !sprintFiles && (
        <p className="text-sm text-muted-foreground">
          Nenhum sprint encontrado nesta wave.
        </p>
      )}
    </div>
  )
}

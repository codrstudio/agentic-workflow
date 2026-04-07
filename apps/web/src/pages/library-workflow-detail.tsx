import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface StepDef {
  type: string
  task?: string
  workflow?: string
  stop_on?: string
  schema?: unknown
  features_file?: string
  agent?: string
}

interface WorkflowDetail {
  slug: string
  name: string
  description?: string
  sprint?: boolean
  stepCount: number
  taskRefs: string[]
  raw: string
  steps: StepDef[]
}

const STEP_TYPE_LABELS: Record<string, string> = {
  "spawn-agent": "spawn-agent",
  "ralph-wiggum-loop": "ralph-wiggum-loop",
  "chain-workflow": "chain-workflow",
  "spawn-workflow": "spawn-workflow",
  "stop-on-wave-limit": "stop-on-wave-limit",
}

export function LibraryWorkflowDetailPage() {
  const { slug } = useParams({ from: "/_auth/library/workflows/$slug" })
  const [data, setData] = useState<WorkflowDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/api/v1/library/workflows/${slug}`)
      .then((r) => r.json() as Promise<WorkflowDetail>)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse mb-4" />
        <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">Workflow não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <Link
        to="/library/workflows"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3 h-3" /> Workflows
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">{data.name}</h1>
        {data.description && (
          <p className="text-sm text-muted-foreground">{data.description}</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
          <span>{data.stepCount} steps</span>
          {data.sprint && <span className="px-1.5 py-0.5 rounded bg-muted text-xs">sprint</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Steps */}
        <section className="bg-card border rounded-lg p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Steps
          </h2>
          <ol className="flex flex-col gap-2">
            {data.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="text-muted-foreground text-xs font-mono w-5 shrink-0 text-right">
                  {i + 1}.
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-muted inline-block w-fit">
                    {STEP_TYPE_LABELS[step.type] ?? step.type}
                  </span>
                  {step.task && (
                    <Link
                      to="/library/tasks/$slug"
                      params={{ slug: step.task }}
                      className="text-xs text-primary hover:underline"
                    >
                      {step.task}
                    </Link>
                  )}
                  {step.workflow && (
                    <Link
                      to="/library/workflows/$slug"
                      params={{ slug: step.workflow }}
                      className="text-xs text-primary hover:underline"
                    >
                      {step.workflow} (recursivo)
                    </Link>
                  )}
                  {step.agent && (
                    <span className="text-xs text-muted-foreground">
                      agent:{" "}
                      <Link
                        to="/library/agents/$slug"
                        params={{ slug: step.agent }}
                        className="text-primary hover:underline"
                      >
                        {step.agent}
                      </Link>
                    </span>
                  )}
                  {step.stop_on && (
                    <span className="text-xs text-muted-foreground font-mono">
                      stop_on: {step.stop_on}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {data.taskRefs.length > 0 && (
            <>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-4 mb-2">
                Tasks referenciadas
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {data.taskRefs.map((t) => (
                  <Link
                    key={t}
                    to="/library/tasks/$slug"
                    params={{ slug: t }}
                    className="text-xs font-mono px-2 py-0.5 rounded bg-muted hover:bg-accent transition-colors"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>

        {/* YAML source */}
        <section className="bg-card border rounded-lg p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            YAML
          </h2>
          <MarkdownViewer content={"```yaml\n" + data.raw + "\n```"} />
        </section>
      </div>
    </div>
  )
}

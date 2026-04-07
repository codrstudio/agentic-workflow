import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface TaskDetail {
  slug: string
  agent?: string
  description?: string
  needs?: string
  content: string
  usedByWorkflows: string[]
  tiers: Array<{ plan: string; tier: string }>
}

export function LibraryTaskDetailPage() {
  const { slug } = useParams({ from: "/_auth/library/tasks/$slug" })
  const [data, setData] = useState<TaskDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/api/v1/library/tasks/${slug}`)
      .then((r) => r.json() as Promise<TaskDetail>)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse mb-4" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">Task não encontrada.</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl">
      <Link
        to="/library/tasks"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3 h-3" /> Tasks
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold font-mono mb-1">{data.slug}</h1>
        {data.description && (
          <p className="text-sm text-muted-foreground">{data.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Metadata */}
        <div className="flex flex-col gap-4">
          <section className="bg-card border rounded-lg p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Metadados
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              {data.agent && (
                <div>
                  <dt className="text-xs text-muted-foreground">Agent</dt>
                  <dd>
                    <Link
                      to="/library/agents/$slug"
                      params={{ slug: data.agent }}
                      className="text-sm text-primary hover:underline font-mono"
                    >
                      {data.agent}
                    </Link>
                  </dd>
                </div>
              )}
              {data.needs && (
                <div>
                  <dt className="text-xs text-muted-foreground">Needs</dt>
                  <dd className="font-mono text-xs">{data.needs}</dd>
                </div>
              )}
            </dl>
          </section>

          {data.tiers.length > 0 && (
            <section className="bg-card border rounded-lg p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Tiers
              </h2>
              <dl className="flex flex-col gap-1.5">
                {data.tiers.map((t) => (
                  <div key={t.plan} className="flex items-center justify-between text-xs">
                    <Link
                      to="/library/plans/$slug"
                      params={{ slug: t.plan }}
                      className="text-primary hover:underline"
                    >
                      {t.plan}
                    </Link>
                    <span className="font-mono text-muted-foreground">{t.tier}</span>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {data.usedByWorkflows.length > 0 && (
            <section className="bg-card border rounded-lg p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Usada em workflows
              </h2>
              <div className="flex flex-col gap-1">
                {data.usedByWorkflows.map((w) => (
                  <Link
                    key={w}
                    to="/library/workflows/$slug"
                    params={{ slug: w }}
                    className="text-xs text-primary hover:underline font-mono"
                  >
                    {w}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Content */}
        <section className="bg-card border rounded-lg p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Conteúdo
          </h2>
          <MarkdownViewer content={data.content} />
        </section>
      </div>
    </div>
  )
}

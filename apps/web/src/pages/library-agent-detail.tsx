import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface AgentDetail {
  slug: string
  allowedTools?: string
  max_turns?: number
  rollback?: string
  timeout_minutes?: number
  content: string
  usedByTasks: string[]
}

export function LibraryAgentDetailPage() {
  const { slug } = useParams({ from: "/_auth/library/agents/$slug" })
  const [data, setData] = useState<AgentDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/api/v1/library/agents/${slug}`)
      .then((r) => r.json() as Promise<AgentDetail>)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-6 bg-muted rounded w-1/4 animate-pulse mb-4" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">Agent não encontrado.</p>
      </div>
    )
  }

  const tools = data.allowedTools?.split(",").map((t) => t.trim()) ?? []

  return (
    <div className="p-6 max-w-6xl">
      <Link
        to="/library/agents"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3 h-3" /> Agents
      </Link>

      <h1 className="text-xl font-semibold font-mono mb-6">{data.slug}</h1>

      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Metadata */}
        <div className="flex flex-col gap-4">
          <section className="bg-card border rounded-lg p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Configuração
            </h2>
            <dl className="flex flex-col gap-2 text-sm">
              {data.max_turns != null && (
                <div className="flex justify-between">
                  <dt className="text-xs text-muted-foreground">max_turns</dt>
                  <dd className="font-mono text-xs">{data.max_turns}</dd>
                </div>
              )}
              {data.timeout_minutes != null && (
                <div className="flex justify-between">
                  <dt className="text-xs text-muted-foreground">timeout</dt>
                  <dd className="font-mono text-xs">{data.timeout_minutes}min</dd>
                </div>
              )}
              {data.rollback && (
                <div className="flex justify-between">
                  <dt className="text-xs text-muted-foreground">rollback</dt>
                  <dd className="font-mono text-xs">{data.rollback}</dd>
                </div>
              )}
            </dl>
            {tools.length > 0 && (
              <>
                <h3 className="text-xs text-muted-foreground mt-3 mb-1.5">Tools</h3>
                <div className="flex flex-wrap gap-1">
                  {tools.map((t) => (
                    <span key={t} className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted">
                      {t}
                    </span>
                  ))}
                </div>
              </>
            )}
          </section>

          {data.usedByTasks.length > 0 && (
            <section className="bg-card border rounded-lg p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Tasks que usam este agent
              </h2>
              <div className="flex flex-col gap-1">
                {data.usedByTasks.map((t) => (
                  <Link
                    key={t}
                    to="/library/tasks/$slug"
                    params={{ slug: t }}
                    className="text-xs text-primary hover:underline font-mono"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* System prompt */}
        <section className="bg-card border rounded-lg p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            System Prompt
          </h2>
          <MarkdownViewer content={data.content} />
        </section>
      </div>
    </div>
  )
}

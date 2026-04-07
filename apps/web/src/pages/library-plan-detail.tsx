import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface PlanDetail {
  slug: string
  name: string
  description?: string
  tiers: Record<string, string>
  escalation: Record<string, string>
  raw: string
}

export function LibraryPlanDetailPage() {
  const { slug } = useParams({ from: "/_auth/library/plans/$slug" })
  const [data, setData] = useState<PlanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch(`/api/v1/library/plans/${slug}`)
      .then((r) => r.json() as Promise<PlanDetail>)
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
        <p className="text-destructive text-sm">Plan não encontrado.</p>
      </div>
    )
  }

  const tierEntries = Object.entries(data.tiers)
  const escalationEntries = Object.entries(data.escalation)

  return (
    <div className="p-6 max-w-6xl">
      <Link
        to="/library/plans"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-3 h-3" /> Plans
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold mb-1">{data.name}</h1>
        {data.description && (
          <p className="text-sm text-muted-foreground">{data.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Tiers + Escalation */}
        <div className="flex flex-col gap-4">
          <section className="bg-card border rounded-lg p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Tiers
            </h2>
            {tierEntries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum tier definido.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {tierEntries.map(([task, tier]) => (
                  <div key={task} className="flex items-center justify-between text-xs">
                    <Link
                      to="/library/tasks/$slug"
                      params={{ slug: task }}
                      className="text-primary hover:underline font-mono"
                    >
                      {task}
                    </Link>
                    <span className="font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {tier}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {escalationEntries.length > 0 && (
            <section className="bg-card border rounded-lg p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Escalation
              </h2>
              <div className="flex flex-col gap-1.5">
                {escalationEntries.map(([task, tier]) => (
                  <div key={task} className="flex items-center justify-between text-xs">
                    <Link
                      to="/library/tasks/$slug"
                      params={{ slug: task }}
                      className="text-primary hover:underline font-mono"
                    >
                      {task}
                    </Link>
                    <span className="font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                      {tier}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

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

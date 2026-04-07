import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"

interface TaskItem {
  slug: string
  agent?: string
  description?: string
  needs?: string
  usedByWorkflows: string[]
  tiers: Array<{ plan: string; tier: string }>
}

export function LibraryTasksPage() {
  const [items, setItems] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/api/v1/library/tasks")
      .then((r) => r.json() as Promise<TaskItem[]>)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col p-6">
      <h1 className="text-xl font-semibold mb-6">Tasks</h1>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma task encontrada.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <Link
              key={t.slug}
              to="/library/tasks/$slug"
              params={{ slug: t.slug }}
              className="block bg-card border rounded-lg p-5 hover:border-foreground/30 hover:shadow-sm transition-all"
            >
              <h2 className="font-medium text-sm font-mono mb-1">{t.slug}</h2>
              {t.description && (
                <p className="text-muted-foreground text-xs line-clamp-2 mb-3">{t.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {t.agent && (
                  <span>
                    agent: <span className="text-foreground">{t.agent}</span>
                  </span>
                )}
                {t.usedByWorkflows.length > 0 && (
                  <span>{t.usedByWorkflows.length} workflows</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

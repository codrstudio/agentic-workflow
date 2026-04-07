import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"

interface PlanItem {
  slug: string
  name: string
  description?: string
  tierCount: number
  taskRefs: string[]
}

export function LibraryPlansPage() {
  const [items, setItems] = useState<PlanItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/api/v1/library/plans")
      .then((r) => r.json() as Promise<PlanItem[]>)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col p-6">
      <h1 className="text-xl font-semibold mb-6">Plans</h1>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-3" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum plan encontrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Link
              key={p.slug}
              to="/library/plans/$slug"
              params={{ slug: p.slug }}
              className="block bg-card border rounded-lg p-5 hover:border-foreground/30 hover:shadow-sm transition-all"
            >
              <h2 className="font-medium text-sm mb-1">{p.name}</h2>
              {p.description && (
                <p className="text-muted-foreground text-xs line-clamp-2 mb-3">{p.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{p.tierCount} tiers</span>
                <span>{p.taskRefs.length} tasks</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

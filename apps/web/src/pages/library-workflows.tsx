import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"

interface WorkflowItem {
  slug: string
  name: string
  description?: string
  sprint?: boolean
  stepCount: number
  taskRefs: string[]
}

export function LibraryWorkflowsPage() {
  const [items, setItems] = useState<WorkflowItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/api/v1/library/workflows")
      .then((r) => r.json() as Promise<WorkflowItem[]>)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col p-6">
      <h1 className="text-xl font-semibold mb-6">Workflows</h1>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum workflow encontrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((w) => (
            <Link
              key={w.slug}
              to="/library/workflows/$slug"
              params={{ slug: w.slug }}
              className="block bg-card border rounded-lg p-5 hover:border-foreground/30 hover:shadow-sm transition-all"
            >
              <h2 className="font-medium text-sm mb-1">{w.name}</h2>
              {w.description && (
                <p className="text-muted-foreground text-xs line-clamp-2 mb-3">{w.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{w.stepCount} steps</span>
                {w.sprint && <span>sprint</span>}
                <span>{w.taskRefs.length} tasks</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

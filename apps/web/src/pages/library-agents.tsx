import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"

interface AgentItem {
  slug: string
  allowedTools?: string
  max_turns?: number
  rollback?: string
  timeout_minutes?: number
  usedByTasks: string[]
}

export function LibraryAgentsPage() {
  const [items, setItems] = useState<AgentItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/api/v1/library/agents")
      .then((r) => r.json() as Promise<AgentItem[]>)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col p-6">
      <h1 className="text-xl font-semibold mb-6">Agents</h1>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/2 mb-3" />
              <div className="h-3 bg-muted rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum agent encontrado.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <Link
              key={a.slug}
              to="/library/agents/$slug"
              params={{ slug: a.slug }}
              className="block bg-card border rounded-lg p-5 hover:border-foreground/30 hover:shadow-sm transition-all"
            >
              <h2 className="font-medium text-sm font-mono mb-2">{a.slug}</h2>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                {a.max_turns != null && <span>max_turns: {a.max_turns}</span>}
                {a.timeout_minutes != null && <span>timeout: {a.timeout_minutes}min</span>}
                {a.usedByTasks.length > 0 && (
                  <span>{a.usedByTasks.length} tasks</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

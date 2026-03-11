import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Plus } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
}

interface ActiveRun {
  slug: string
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSlugs, setActiveSlugs] = useState<Set<string>>(new Set())

  useEffect(() => {
    apiFetch("/api/v1/projects")
      .then((res) => res.json() as Promise<Project[]>)
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    apiFetch("/api/v1/runs/active")
      .then((r) => r.json() as Promise<ActiveRun[]>)
      .then((runs) => setActiveSlugs(new Set(runs.map((r) => r.slug))))
      .catch(() => undefined)
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Projetos</h1>
          <Link
            to="/projects/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-card border rounded-lg p-5 animate-pulse"
            >
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/3 mb-4" />
              <div className="h-5 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="flex flex-col p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-semibold">Projetos</h1>
          <Link
            to="/projects/new"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Projeto
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-muted-foreground text-sm">Nenhum projeto encontrado.</p>
          <p className="text-muted-foreground text-xs mt-1">
            Adicione um projeto em{" "}
            <code className="font-mono">context/projects/</code> para começar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col p-6">
      <h1 className="mb-6 text-xl font-semibold">Projetos</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.slug}
            to="/projects/$slug"
            params={{ slug: project.slug }}
            className="bg-card border rounded-lg p-5 hover:border-foreground/30 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-2 min-w-0">
                {activeSlugs.has(project.slug) && (
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
                  </span>
                )}
                <h2 className="font-medium text-sm leading-snug">{project.name}</h2>
              </div>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-muted-foreground text-xs font-mono mb-2">{project.slug}</p>
            {project.description && (
              <p className="text-muted-foreground text-xs line-clamp-2">{project.description}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

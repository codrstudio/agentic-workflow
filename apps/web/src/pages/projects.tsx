import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { apiFetch } from "@/lib/api"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
}

function StatusBadge({ status }: { status?: string }) {
  const label = status ?? "unknown"
  const colorClass =
    label === "active"
      ? "bg-green-500/15 text-green-700 dark:text-green-400"
      : label === "completed"
        ? "bg-blue-500/15 text-blue-700 dark:text-blue-400"
        : label === "failed"
          ? "bg-red-500/15 text-red-700 dark:text-red-400"
          : "bg-muted text-muted-foreground"

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch("/api/v1/projects")
      .then((res) => res.json() as Promise<Project[]>)
      .then(setProjects)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col p-6">
        <h1 className="mb-6 text-xl font-semibold">Projetos</h1>
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
        <h1 className="mb-6 text-xl font-semibold">Projetos</h1>
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
              <h2 className="font-medium text-sm leading-snug">{project.name}</h2>
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

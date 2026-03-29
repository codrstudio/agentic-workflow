import { useEffect, useState } from "react"
import { Link } from "@tanstack/react-router"
import { Plus, Star, AlertTriangle } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
}

interface ProjectsResponse {
  total: number
  offset: number
  limit: number
  projects: Project[]
}

interface ActiveRun {
  slug: string
  wave_status?: string | null
  last_output_age_ms?: number | null
}

const STUCK_THRESHOLD_MS = 5 * 60_000

const LIMIT = 12
const FAV_KEY = "aw_favorites"

function loadFavorites(): Project[] {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]") as Project[]
  } catch {
    return []
  }
}

function saveFavorites(favs: Project[]) {
  localStorage.setItem(FAV_KEY, JSON.stringify(favs))
}

function Header() {
  return (
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
  )
}

function ProjectCard({
  project,
  isFavorite,
  activeRun,
  onToggleFavorite,
}: {
  project: Project
  isFavorite: boolean
  activeRun: ActiveRun | undefined
  onToggleFavorite: (project: Project, e: React.MouseEvent) => void
}) {
  const isActive = !!activeRun
  const isStuck =
    isActive &&
    activeRun.last_output_age_ms != null &&
    activeRun.last_output_age_ms > STUCK_THRESHOLD_MS

  return (
    <Link
      to="/projects/$slug/info"
      params={{ slug: project.slug }}
      className="block bg-card border rounded-lg p-5 hover:border-foreground/30 hover:shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          {isActive && (
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
            </span>
          )}
          <h2 className="font-medium text-sm leading-snug">{project.name}</h2>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isActive && activeRun.wave_status ? (
            <StatusBadge status={activeRun.wave_status} />
          ) : (
            <StatusBadge status={project.status} />
          )}
          {isStuck && (
            <span title="Possivelmente travado" className="text-amber-500">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          )}
          <button
            onClick={(e) => onToggleFavorite(project, e)}
            className="p-0.5 rounded transition-colors"
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star
              className="w-4 h-4"
              fill={isFavorite ? "#eab308" : "none"}
              stroke={isFavorite ? "#eab308" : "currentColor"}
            />
          </button>
        </div>
      </div>
      <p className="text-muted-foreground text-xs font-mono mb-2">{project.slug}</p>
      {project.description && (
        <p className="text-muted-foreground text-xs line-clamp-2">{project.description}</p>
      )}
    </Link>
  )
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [favorites, setFavorites] = useState<Project[]>(() => loadFavorites())
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeRunsMap, setActiveRunsMap] = useState<Map<string, ActiveRun>>(new Map())

  async function fetchProjects(offset: number) {
    const res = await apiFetch(`/api/v1/projects?offset=${offset}&limit=${LIMIT}`)
    const data = await res.json() as ProjectsResponse
    setTotal(data.total)
    if (offset === 0) {
      setProjects(data.projects)
    } else {
      setProjects((prev) => [...prev, ...data.projects])
    }
  }

  useEffect(() => {
    fetchProjects(0).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    apiFetch("/api/v1/runs/active")
      .then((r) => r.json() as Promise<ActiveRun[]>)
      .then((runs) => setActiveRunsMap(new Map(runs.map((r) => [r.slug, r]))))
      .catch(() => undefined)
  }, [])

  function toggleFavorite(project: Project, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setFavorites((prev) => {
      const isFav = prev.some((f) => f.slug === project.slug)
      const next = isFav
        ? prev.filter((f) => f.slug !== project.slug)
        : [...prev, project]
      saveFavorites(next)
      return next
    })
  }

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      await fetchProjects(projects.length)
    } finally {
      setLoadingMore(false)
    }
  }

  const favSlugs = new Set(favorites.map((f) => f.slug))
  const visibleProjects = projects.filter((p) => !favSlugs.has(p.slug))
  const hasMore = favorites.length + projects.length < total


  if (loading) {
    return (
      <div className="flex flex-col p-6">
        <Header />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/3 mb-4" />
              <div className="h-5 bg-muted rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (favorites.length === 0 && projects.length === 0) {
    return (
      <div className="flex flex-col p-6">
        <Header />
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
      <Header />

      {favorites.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Favoritos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((project) => (
              <ProjectCard
                key={project.slug}
                project={project}
                isFavorite={true}
                activeRun={activeRunsMap.get(project.slug)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </section>
      )}

      {visibleProjects.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Projetos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((project) => (
              <ProjectCard
                key={project.slug}
                project={project}
                isFavorite={false}
                activeRun={activeRunsMap.get(project.slug)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Carregando..." : "Carregar mais"}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

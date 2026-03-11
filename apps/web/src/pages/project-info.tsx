import { useEffect, useState } from "react"
import { useParams, Link } from "@tanstack/react-router"
import { Pencil, Play } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@/components/ui/status-badge"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
  params?: Record<string, string>
  source_folder?: string
  target_folder?: string
}

interface Run {
  id: string
  workflow: string
  status: "running" | "completed" | "failed"
}

export function ProjectInfoPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/info" })

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskContent, setTaskContent] = useState('')

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}`).then((r) => r.json() as Promise<Project>),
      apiFetch(`/api/v1/projects/${slug}/task`).then((r) => r.json() as Promise<{ content: string }>),
    ])
      .then(([p, t]) => {
        setProject(p)
        setTaskContent(t.content)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="flex flex-col p-6 gap-6">
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex flex-col p-6">
        <p className="text-destructive text-sm" role="alert">
          {error ?? "Projeto não encontrado"}
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 h-full">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-8 items-start max-w-6xl">
        {/* Coluna esquerda: Header + Metadata */}
        <div className="flex flex-col gap-6 w-full">
          {/* Header */}
          <section>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-semibold">{project.name}</h1>
                  <StatusBadge status={project.status} />
                </div>
                <p className="text-muted-foreground text-xs font-mono mb-2">{project.slug}</p>
                {project.description && (
                  <p className="text-sm text-muted-foreground">{project.description}</p>
                )}
              </div>
              <Link
                to="/projects/$slug/runs/new"
                params={{ slug }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
              >
                <Play className="w-3.5 h-3.5" />
                Executar Workflow
              </Link>
            </div>
          </section>

          {/* Metadata */}
          {(project.source_folder || project.target_folder || project.params) && (
            <section className="bg-card border rounded-lg p-4">
              <h2 className="text-sm font-semibold mb-3">Metadata</h2>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {project.source_folder && (
                  <>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="font-mono text-xs">{project.source_folder}</dd>
                  </>
                )}
                {project.target_folder && (
                  <>
                    <dt className="text-muted-foreground">Target</dt>
                    <dd className="font-mono text-xs">{project.target_folder}</dd>
                  </>
                )}
                {project.params && Object.entries(project.params).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-mono text-xs">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {/* Coluna direita: Prompt (TASK.md) */}
        <section className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold">Prompt (TASK.md)</h2>
            <Link
              to="/projects/$slug/task/edit"
              params={{ slug }}
              className="p-1 rounded hover:bg-muted text-muted-foreground"
              title="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </Link>
          </div>
          {taskContent ? (
            <div className="bg-card border rounded-lg p-4">
              <MarkdownViewer content={taskContent} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem prompt definido.</p>
          )}
        </section>
      </div>
    </div>
  )
}

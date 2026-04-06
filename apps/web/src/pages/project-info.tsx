import { useEffect, useState, useRef, useCallback } from "react"
import { useParams, Link, useNavigate } from "@tanstack/react-router"
import { Pencil, Folder, FolderOpen, File, ChevronLeft, Plus, X, Loader2, Copy, Check } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
  params?: Record<string, string>
  source_folder?: string
  target_folder?: string
  repo?: { url: string; source_branch: string; target_branch?: string }
  workspace?: { project: string; workflow: string; created_at: string } | null
}

interface WaveStep {
  started_at?: string
  finished_at?: string
  status: string
}

interface Wave {
  wave_number: number
  status: string
  steps_total: number
  steps_completed: number
  steps: WaveStep[]
}

interface ArtifactItem {
  path: string
  type: "file" | "dir"
  size?: number
}

interface MetaEdit {
  description: string
  source_folder: string
  target_folder: string
  params: Array<[string, string]>
  repoUrl: string
  repoSourceBranch: string
  repoTargetBranch: string
}

function computeWaveDuration(wave: Wave): string {
  const starts = wave.steps.filter(s => s.started_at).map(s => new Date(s.started_at!).getTime())
  if (starts.length === 0) return "—"
  const firstStart = Math.min(...starts)
  let endTime: number
  if (wave.status === "running" || wave.status === "in_progress") {
    endTime = Date.now()
  } else {
    const ends = wave.steps.filter(s => s.finished_at).map(s => new Date(s.finished_at!).getTime())
    endTime = ends.length > 0 ? Math.max(...ends) : Date.now()
  }
  const ms = endTime - firstStart
  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`
}

function getArtifactChildren(items: ArtifactItem[], parentPath: string): ArtifactItem[] {
  if (!parentPath) {
    return items.filter(i => !i.path.includes("/"))
  }
  const prefix = parentPath + "/"
  return items
    .filter(i => i.path.startsWith(prefix))
    .filter(i => !i.path.slice(prefix.length).includes("/"))
}

function projectToMetaEdit(project: Project): MetaEdit {
  return {
    description: project.description ?? "",
    source_folder: project.source_folder ?? "",
    target_folder: project.target_folder ?? "",
    params: project.params ? Object.entries(project.params) : [],
    repoUrl: project.repo?.url ?? "",
    repoSourceBranch: project.repo?.source_branch ?? "",
    repoTargetBranch: project.repo?.target_branch ?? "",
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const copy = () => {
    void navigator.clipboard.writeText(value)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      onClick={copy}
      className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/row:opacity-100"
      title="Copiar"
    >
      {copied
        ? <Check className="w-3 h-3 text-green-500" />
        : <Copy className="w-3 h-3" />}
    </button>
  )
}

function truncateMiddle(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const keep = Math.floor((maxLen - 3) / 2)
  return text.slice(0, keep) + "..." + text.slice(-keep)
}

function InfoRow({ label, value, truncate: maxLen, actions }: {
  label: string
  value: string
  truncate?: number
  actions?: React.ReactNode
}) {
  const display = maxLen ? truncateMiddle(value, maxLen) : value
  return (
    <div className="group/row flex items-center gap-3 py-1.5 min-w-0" title={display !== value ? value : undefined}>
      <dt className="text-muted-foreground text-xs shrink-0 w-24">{label}</dt>
      <dd className="font-mono text-xs truncate flex-1 min-w-0">{display}</dd>
      <div className="flex items-center gap-0.5 shrink-0">
        {actions ?? <CopyButton value={value} />}
      </div>
    </div>
  )
}

export function ProjectInfoPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/info" })
  const navigate = useNavigate()

  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [taskContent, setTaskContent] = useState("")

  const [waves, setWaves] = useState<Wave[]>([])
  const [wavesLoading, setWavesLoading] = useState(true)

  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([])
  const [artifactsLoading, setArtifactsLoading] = useState(true)
  const [artifactsPath, setArtifactsPath] = useState("")

  const [repoPath, setRepoPath] = useState("")

  const [editingMeta, setEditingMeta] = useState(false)
  const [metaEdit, setMetaEdit] = useState<MetaEdit | null>(null)
  const [metaSaving, setMetaSaving] = useState(false)
  const [metaError, setMetaError] = useState<string | null>(null)
  const [gitTestStatus, setGitTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      apiFetch(`/api/v1/projects/${slug}`).then(r => r.json() as Promise<Project>),
      apiFetch(`/api/v1/projects/${slug}/task`).then(r => r.json() as Promise<{ content: string }>),
    ])
      .then(([p, t]) => {
        setProject(p)
        setTaskContent(t.content)
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    setWavesLoading(true)
    apiFetch(`/api/v1/projects/${slug}/waves`)
      .then(r => r.json() as Promise<Wave[]>)
      .then(setWaves)
      .catch(() => setWaves([]))
      .finally(() => setWavesLoading(false))
  }, [slug])

  useEffect(() => {
    setArtifactsLoading(true)
    apiFetch(`/api/v1/projects/${slug}/artifacts`)
      .then(r => r.json() as Promise<ArtifactItem[]>)
      .then(setArtifacts)
      .catch(() => setArtifacts([]))
      .finally(() => setArtifactsLoading(false))
  }, [slug])

  useEffect(() => {
    apiFetch(`/api/v1/projects/${slug}/repo-path`)
      .then(r => r.ok ? r.json() as Promise<{ path: string }> : null)
      .then(data => { if (data) setRepoPath(data.path) })
      .catch(() => { /* workspace may not exist */ })
  }, [slug])

  const openRepoFolder = useCallback(() => {
    void apiFetch(`/api/v1/projects/${slug}/open-repo`, { method: "POST" })
  }, [slug])

  const enterEditMode = () => {
    if (!project) return
    setMetaEdit(projectToMetaEdit(project))
    setMetaError(null)
    setEditingMeta(true)
  }

  const cancelEdit = () => {
    setEditingMeta(false)
    setMetaEdit(null)
    setMetaError(null)
    setGitTestStatus('idle')
  }

  const testGitAccess = async () => {
    if (!metaEdit?.repoUrl) return
    setGitTestStatus('testing')
    try {
      const res = await apiFetch(`/api/v1/projects/${slug}/test-git`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: metaEdit.repoUrl }),
      })
      const data = await res.json() as { ok: boolean }
      setGitTestStatus(data.ok ? 'ok' : 'error')
    } catch {
      setGitTestStatus('error')
    }
  }

  const saveMeta = async () => {
    if (!metaEdit || !project) return
    setMetaSaving(true)
    setMetaError(null)
    try {
      const params = Object.fromEntries(metaEdit.params.filter(([k]) => k.trim()))
      const body: Record<string, unknown> = {
        description: metaEdit.description || undefined,
        source_folder: metaEdit.source_folder || undefined,
        target_folder: metaEdit.target_folder || undefined,
        params: Object.keys(params).length > 0 ? params : undefined,
      }
      if (metaEdit.repoUrl) {
        body.repo = {
          url: metaEdit.repoUrl,
          source_branch: metaEdit.repoSourceBranch,
          ...(metaEdit.repoTargetBranch ? { target_branch: metaEdit.repoTargetBranch } : {}),
        }
      } else {
        body.repo = null
      }
      const res = await apiFetch(`/api/v1/projects/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? "Erro ao salvar")
      }
      const updated = await res.json() as Project
      setProject(updated)
      setEditingMeta(false)
      setMetaEdit(null)
    } catch (e: unknown) {
      setMetaError(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setMetaSaving(false)
    }
  }

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

  const artifactChildren = getArtifactChildren(artifacts, artifactsPath)
  const sortedChildren = [
    ...artifactChildren.filter(i => i.type === "dir").sort((a, b) => a.path.localeCompare(b.path)),
    ...artifactChildren.filter(i => i.type === "file").sort((a, b) => a.path.localeCompare(b.path)),
  ]
  const artifactDisplayName = (item: ArtifactItem) =>
    artifactsPath ? item.path.slice(artifactsPath.length + 1) : item.path
  const artifactParentPath = artifactsPath.includes("/")
    ? artifactsPath.slice(0, artifactsPath.lastIndexOf("/"))
    : ""

  return (
    <div className="p-6 h-full">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-8 items-start max-w-6xl">
        {/* Coluna esquerda */}
        <div className="flex flex-col gap-4 w-full">
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
            </div>
          </section>

          {/* Card: Metadata + Git */}
          <section className="bg-card border rounded-lg">
            {editingMeta && metaEdit ? (
              <div className="p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Editar</h2>
                </div>
                {metaError && (
                  <p className="text-destructive text-xs p-2 bg-destructive/10 rounded">{metaError}</p>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Descrição</label>
                  <input
                    type="text"
                    value={metaEdit.description}
                    onChange={e => setMetaEdit(m => m ? { ...m, description: e.target.value } : m)}
                    className="border rounded px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="flex flex-col gap-2 border-t pt-3">
                  <label className="text-xs text-muted-foreground font-medium">Git</label>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">URL do repositório</label>
                    <input
                      type="text"
                      value={metaEdit.repoUrl}
                      onChange={e => { setMetaEdit(m => m ? { ...m, repoUrl: e.target.value } : m); setGitTestStatus('idle'); }}
                      className="border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="https://github.com/org/repo.git"
                    />
                  </div>
                  {metaEdit.repoUrl && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Source branch</label>
                        <input
                          type="text"
                          value={metaEdit.repoSourceBranch}
                          onChange={e => setMetaEdit(m => m ? { ...m, repoSourceBranch: e.target.value } : m)}
                          className="border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="main"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs text-muted-foreground">Target branch</label>
                        <input
                          type="text"
                          value={metaEdit.repoTargetBranch}
                          onChange={e => setMetaEdit(m => m ? { ...m, repoTargetBranch: e.target.value } : m)}
                          className="border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                          placeholder="feature/..."
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 border-t pt-3">
                  <label className="text-xs text-muted-foreground font-medium">Pastas</label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Source folder</label>
                      <input
                        type="text"
                        value={metaEdit.source_folder}
                        onChange={e => setMetaEdit(m => m ? { ...m, source_folder: e.target.value } : m)}
                        className="border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Target folder</label>
                      <input
                        type="text"
                        value={metaEdit.target_folder}
                        onChange={e => setMetaEdit(m => m ? { ...m, target_folder: e.target.value } : m)}
                        className="border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 border-t pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-muted-foreground font-medium">Parâmetros</label>
                    <button
                      type="button"
                      onClick={() => setMetaEdit(m => m ? { ...m, params: [...m.params, ["", ""]] } : m)}
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="w-3 h-3" /> Adicionar
                    </button>
                  </div>
                  {metaEdit.params.map(([k, v], i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={k}
                        placeholder="chave"
                        onChange={e => setMetaEdit(m => {
                          if (!m) return m
                          const p = [...m.params]
                          p[i] = [e.target.value, p[i]?.[1] ?? ""]
                          return { ...m, params: p }
                        })}
                        className="border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring flex-1"
                      />
                      <input
                        type="text"
                        value={v}
                        placeholder="valor"
                        onChange={e => setMetaEdit(m => {
                          if (!m) return m
                          const p = [...m.params]
                          p[i] = [p[i]?.[0] ?? "", e.target.value]
                          return { ...m, params: p }
                        })}
                        className="border rounded px-2 py-1 text-xs font-mono bg-background focus:outline-none focus:ring-1 focus:ring-ring flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setMetaEdit(m => m ? { ...m, params: m.params.filter((_, j) => j !== i) } : m)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void testGitAccess()}
                    disabled={!metaEdit.repoUrl || gitTestStatus === 'testing'}
                    className="flex items-center gap-1 px-3 py-1.5 rounded border text-xs hover:bg-muted transition-colors disabled:opacity-40"
                  >
                    {gitTestStatus === 'testing'
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Testando...</>
                      : 'Testar acesso'}
                  </button>
                  {gitTestStatus === 'ok' && <span className="text-xs text-green-600 dark:text-green-400">Acessível</span>}
                  {gitTestStatus === 'error' && <span className="text-xs text-destructive">Sem acesso</span>}
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={cancelEdit}
                    disabled={metaSaving}
                    className="px-3 py-1.5 rounded text-xs border hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={saveMeta}
                    disabled={metaSaving}
                    className="px-3 py-1.5 rounded text-xs bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {metaSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                    Salvar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Seção: Repositório */}
                {project.repo && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Repositório
                      </h2>
                      <button
                        onClick={enterEditMode}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <dl>
                      <InfoRow label="URL" value={project.repo.url} truncate={40} />
                      <InfoRow label="Branch" value={project.repo.source_branch} />
                      {project.repo.target_branch && (
                        <InfoRow label="Target branch" value={project.repo.target_branch} />
                      )}
                      {repoPath && (
                        <InfoRow
                          label="Pasta"
                          value={repoPath}
                          truncate={40}
                          actions={
                            <div className="flex items-center gap-0.5">
                              <CopyButton value={repoPath} />
                              <button
                                onClick={openRepoFolder}
                                className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/row:opacity-100"
                                title="Abrir no Explorer"
                              >
                                <FolderOpen className="w-3 h-3" />
                              </button>
                            </div>
                          }
                        />
                      )}
                    </dl>
                  </div>
                )}

                {/* Seção: Pastas & Parâmetros */}
                {(project.source_folder || project.target_folder || (project.params && Object.keys(project.params).length > 0)) && (
                  <div className={`p-4 ${project.repo ? "border-t" : ""}`}>
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Pastas &amp; Parâmetros
                      </h2>
                      {!project.repo && (
                        <button
                          onClick={enterEditMode}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <dl>
                      {project.source_folder && (
                        <InfoRow label="Source" value={project.source_folder} truncate={40} />
                      )}
                      {project.target_folder && (
                        <InfoRow label="Target" value={project.target_folder} truncate={40} />
                      )}
                      {project.params && Object.entries(project.params).map(([k, v]) => (
                        <InfoRow key={k} label={k} value={v} />
                      ))}
                    </dl>
                  </div>
                )}

                {/* Pasta do repo (quando existe no disco, mesmo sem config de repo) */}
                {!project.repo && repoPath && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Repositório
                      </h2>
                      <button
                        onClick={enterEditMode}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <dl>
                      <InfoRow
                        label="Pasta"
                        value={repoPath}
                        truncate={40}
                        actions={
                          <div className="flex items-center gap-0.5">
                            <CopyButton value={repoPath} />
                            <button
                              onClick={openRepoFolder}
                              className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/row:opacity-100"
                              title="Abrir no Explorer"
                            >
                              <FolderOpen className="w-3 h-3" />
                            </button>
                          </div>
                        }
                      />
                    </dl>
                  </div>
                )}

                {/* Nenhum dado */}
                {!project.repo && !repoPath && !project.source_folder && !project.target_folder && (!project.params || Object.keys(project.params).length === 0) && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Configuração
                      </h2>
                      <button
                        onClick={enterEditMode}
                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-muted-foreground text-xs">Nenhum metadado configurado.</p>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Card: Histórico de Waves */}
          <section className="bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Histórico de Waves
              </span>
              <Link
                to="/projects/$slug/runs/new"
                params={{ slug }}
                className="text-xs text-primary hover:underline"
              >
                ▷ Executar Workflow
              </Link>
            </div>
            {wavesLoading ? (
              <div className="p-4 flex flex-col gap-2">
                {[0, 1, 2].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
              </div>
            ) : waves.length === 0 ? (
              <p className="text-xs text-muted-foreground p-4">Nenhuma wave executada ainda.</p>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: "10rem" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b bg-muted/30">
                      <th className="px-4 py-2 text-left font-medium">Wave</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Steps</th>
                      <th className="px-4 py-2 text-left font-medium">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waves.map(wave => (
                      <tr
                        key={wave.wave_number}
                        className="border-b last:border-b-0 hover:bg-muted/50 cursor-pointer"
                        onClick={() =>
                          void navigate({
                            to: "/projects/$slug/waves/$waveNumber",
                            params: { slug, waveNumber: String(wave.wave_number) },
                          })
                        }
                      >
                        <td className="px-4 py-2">#{wave.wave_number}</td>
                        <td className="px-4 py-2">
                          <StatusBadge status={wave.status} />
                        </td>
                        <td className="px-4 py-2">
                          {wave.steps_completed}/{wave.steps_total}
                        </td>
                        <td className="px-4 py-2">{computeWaveDuration(wave)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Card: Artefatos */}
          <section className="bg-card border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Artefatos
              </span>
              <Link
                to="/projects/$slug/artifacts"
                params={{ slug }}
                className="text-xs text-primary hover:underline"
              >
                Gerenciar →
              </Link>
            </div>
            {artifactsLoading ? (
              <div className="p-4 flex flex-col gap-2">
                {[0, 1, 2].map(i => <div key={i} className="h-4 bg-muted rounded animate-pulse" />)}
              </div>
            ) : artifacts.length === 0 && !artifactsPath ? (
              <div className="p-4 text-xs text-muted-foreground">
                Nenhum artefato.{" "}
                <Link
                  to="/projects/$slug/artifacts"
                  params={{ slug }}
                  className="text-primary hover:underline"
                >
                  Adicionar →
                </Link>
              </div>
            ) : (
              <div className="overflow-y-auto" style={{ maxHeight: "12rem" }}>
                {artifactsPath && (
                  <button
                    onClick={() => setArtifactsPath(artifactParentPath)}
                    className="flex items-center gap-1 px-4 py-2 text-xs text-muted-foreground hover:text-foreground w-full hover:bg-muted/50 border-b"
                  >
                    <ChevronLeft className="w-3 h-3" /> Voltar
                  </button>
                )}
                {sortedChildren.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-4 py-3">Pasta vazia.</p>
                ) : (
                  sortedChildren.map(item => (
                    <div
                      key={item.path}
                      className={`flex items-center gap-2 px-4 py-2 text-xs border-b last:border-b-0 ${
                        item.type === "dir" ? "hover:bg-muted/50 cursor-pointer" : "opacity-70"
                      }`}
                      onClick={item.type === "dir" ? () => setArtifactsPath(item.path) : undefined}
                    >
                      {item.type === "dir" ? (
                        <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      ) : (
                        <File className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-mono truncate">{artifactDisplayName(item)}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
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

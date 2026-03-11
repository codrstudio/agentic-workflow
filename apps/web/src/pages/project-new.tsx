import { useState, useEffect } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import MDEditor from '@uiw/react-md-editor'
import { Loader2, Plus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'

const generateSlug = (n: string) =>
  n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ProjectNewPage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [sourceBranch, setSourceBranch] = useState('')
  const [targetBranch, setTargetBranch] = useState('')
  const [taskContent, setTaskContent] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [colorMode, setColorMode] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark')
    setColorMode(isDark ? 'dark' : 'light')
  }, [])

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(generateSlug(v))
  }

  const handleFilesAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])])
    e.target.value = ''
  }

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { name, slug, task_content: taskContent }
      if (description) body.description = description
      if (repoUrl) {
        body.repo = {
          url: repoUrl,
          source_branch: sourceBranch,
          ...(targetBranch ? { target_branch: targetBranch } : {}),
        }
      }
      const res = await apiFetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Erro ao criar projeto')
      }
      if (files.length > 0) {
        const fd = new FormData()
        for (const file of files) {
          fd.append('file', file, file.webkitRelativePath || file.name)
        }
        await apiFetch(`/api/v1/projects/${slug}/artifacts`, { method: 'POST', body: fd })
      }
      void navigate({ to: '/projects/$slug/info', params: { slug } })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Projetos
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-semibold">Novo Projeto</h1>
      </div>

      {error && (
        <p className="text-destructive text-sm mb-4 p-3 bg-destructive/10 rounded-md" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Identidade */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">Identidade</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="name">
              Nome <span className="text-destructive">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              required
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Meu Projeto"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="slug">Slug</label>
            <input
              id="slug"
              type="text"
              value={slug}
              onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="meu-projeto"
            />
            {slug && (
              <p className="text-xs text-muted-foreground font-mono">context/projects/{slug}/</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="description">Descrição</label>
            <input
              id="description"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Descrição opcional"
            />
          </div>
        </section>

        {/* Repositório Git */}
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold">Repositório Git</h2>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="repoUrl">URL do repositório</label>
            <input
              id="repoUrl"
              type="text"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="https://github.com/org/repo.git"
            />
          </div>
          {repoUrl && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="sourceBranch">
                  Branch de origem <span className="text-destructive">*</span>
                </label>
                <input
                  id="sourceBranch"
                  type="text"
                  value={sourceBranch}
                  onChange={e => setSourceBranch(e.target.value)}
                  required={!!repoUrl}
                  className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="main"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium" htmlFor="targetBranch">Branch de destino</label>
                <input
                  id="targetBranch"
                  type="text"
                  value={targetBranch}
                  onChange={e => setTargetBranch(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="feature/..."
                />
              </div>
            </>
          )}
        </section>

        {/* Prompt (TASK.md) */}
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Prompt (TASK.md)</h2>
          <div data-color-mode={colorMode}>
            <MDEditor
              value={taskContent}
              onChange={v => setTaskContent(v ?? '')}
              height={400}
            />
          </div>
        </section>

        {/* Artifacts */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Artifacts (opcional)</h2>
          <div className="flex gap-2 flex-wrap">
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Adicionar arquivos
              <input type="file" multiple className="hidden" onChange={handleFilesAdd} />
            </label>
            <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors">
              <Plus className="w-3.5 h-3.5" />
              Adicionar pasta
              <input
                type="file"
                // @ts-expect-error webkitdirectory is not in the types
                webkitdirectory=""
                className="hidden"
                onChange={handleFilesAdd}
              />
            </label>
            {files.length > 0 && (
              <button
                type="button"
                onClick={() => setFiles([])}
                className="px-3 py-1.5 rounded-md border text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Limpar tudo
              </button>
            )}
          </div>
          {files.length > 0 && (
            <ul className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {files.map((f, i) => (
                <li key={i} className="flex items-center justify-between gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                  <span className="font-mono truncate flex-1">{f.webkitRelativePath || f.name}</span>
                  <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(i)}
                    className="text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar Projeto
          </button>
        </div>
      </form>
    </div>
  )
}

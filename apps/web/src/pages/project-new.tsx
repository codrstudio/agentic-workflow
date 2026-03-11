import { useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { apiFetch } from '@/lib/api'

const generateSlug = (n: string) =>
  n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')

export function ProjectNewPage() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleNameChange = (v: string) => {
    setName(v)
    if (!slugEdited) setSlug(generateSlug(v))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { name, slug }
      if (description) body.description = description
      const res = await apiFetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Erro ao criar projeto')
      }
      void navigate({ to: '/projects/$slug/info', params: { slug } })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
      <div className="flex flex-col col-span-1">
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
    </div>
  )
}

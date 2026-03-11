import { useEffect, useState } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import MDEditor from "@uiw/react-md-editor"
import { apiFetch } from "@/lib/api"

export function ProjectTaskEditPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/task/edit" })
  const navigate = useNavigate()

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    apiFetch(`/api/v1/projects/${slug}/task`)
      .then((r) => r.json() as Promise<{ content: string }>)
      .then((t) => setContent(t.content))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [slug])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await apiFetch(`/api/v1/projects/${slug}/task`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const body = (await res.json()) as { error?: string }
        throw new Error(body.error ?? 'Falha ao salvar')
      }
      void navigate({ to: '/projects/$slug/info', params: { slug } })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    void navigate({ to: '/projects/$slug/info', params: { slug } })
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-semibold">
          Editando TASK.md — <span className="font-mono text-muted-foreground">{slug}</span>
        </h1>
        <div className="flex items-center gap-2">
          {error && <p className="text-destructive text-xs">{error}</p>}
          <button
            type="button"
            onClick={handleCancel}
            className="px-3 py-1.5 rounded-md text-sm border hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 bg-muted rounded-lg animate-pulse" />
      ) : (
        <MDEditor
          value={content}
          onChange={(v) => setContent(v ?? '')}
          height="calc(100vh - 160px)"
        />
      )}
    </div>
  )
}

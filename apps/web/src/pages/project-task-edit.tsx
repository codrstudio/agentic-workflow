import { useEffect, useState } from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { Loader2, Eye, EyeOff } from "lucide-react"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"
import { apiFetch } from "@/lib/api"

export function ProjectTaskEditPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/task/edit" })
  const navigate = useNavigate()

  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
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
    <div className="flex flex-col h-full min-h-0 overflow-hidden p-6 gap-4">
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
        <div className="flex-1 flex flex-col gap-2 min-h-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview(p => !p)}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPreview ? "Ocultar preview" : "Mostrar preview"}
            </button>
          </div>
          <div className={`flex-1 grid min-h-0 gap-4 ${showPreview ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-0 w-full resize-none overflow-y-auto rounded-md border border-border bg-background p-4 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              spellCheck={false}
            />
            {showPreview && (
              <div className="min-h-0 overflow-y-auto rounded-md border border-border bg-muted/30 p-4">
                <MarkdownViewer content={content} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

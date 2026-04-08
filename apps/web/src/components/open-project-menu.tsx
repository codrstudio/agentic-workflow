import { useState, useEffect, useRef, useCallback } from "react"
import { ExternalLink, Monitor, Terminal, FolderOpen } from "lucide-react"
import { apiFetch } from "@/lib/api"

interface EditorOption {
  id: string
  label: string
  cmd: string
  wsl: boolean
}

const ICON_MAP: Record<string, typeof Monitor> = {
  code: Monitor,
  "code-wsl": Terminal,
  codium: Monitor,
  "codium-wsl": Terminal,
  antigravity: Monitor,
  "antigravity-wsl": Terminal,
  cursor: Monitor,
  "cursor-wsl": Terminal,
  explorer: FolderOpen,
}

export function OpenProjectMenu({ slug }: { slug: string }) {
  const [editors, setEditors] = useState<EditorOption[] | null>(null)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiFetch("/api/v1/system/editors")
      .then(r => r.json() as Promise<{ editors: EditorOption[] }>)
      .then(d => setEditors(d.editors))
      .catch(() => setEditors([]))
  }, [])

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, handleClickOutside])

  const openWith = (editor: EditorOption) => {
    setOpen(false)
    const body: Record<string, unknown> = { editor: editor.cmd }
    if (editor.wsl) body.wsl = true
    void apiFetch(`/api/v1/projects/${slug}/open-repo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  // While loading or if only explorer is available, show single button
  if (!editors || editors.length <= 1) {
    return (
      <button
        onClick={() => {
          void apiFetch(`/api/v1/projects/${slug}/open-repo`, { method: "POST" })
        }}
        className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/row:opacity-100"
        title="Abrir no Explorer"
      >
        <FolderOpen className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover/row:opacity-100"
        title="Abrir projeto"
      >
        <ExternalLink className="w-3 h-3" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[180px] bg-popover border rounded-md shadow-md py-1 text-xs">
          <div className="px-3 py-1.5 text-muted-foreground font-medium text-[10px] uppercase tracking-wider">
            Abrir projeto
          </div>
          {editors.map((editor, i) => {
            const Icon = ICON_MAP[editor.id] ?? Monitor
            const isExplorer = editor.id === "explorer"
            const prevIsExplorer = i > 0 && editors[i - 1]!.id === "explorer"
            const showSeparator = isExplorer && i > 0 && !prevIsExplorer

            return (
              <div key={editor.id}>
                {showSeparator && <div className="border-t my-1" />}
                <button
                  onClick={() => openWith(editor)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{editor.label}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, Link } from "@tanstack/react-router"
import MDEditor from "@uiw/react-md-editor"
import {
  Folder,
  File as FileIcon,
  Upload,
  Trash2,
  Download,
  X,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { apiFetch } from "@/lib/api"
import { MarkdownViewer } from "@/components/ui/markdown-viewer"

interface ArtifactItem {
  path: string
  type: "file" | "dir"
  size?: number
}

interface PendingFile {
  file: File
  relativePath: string
  status: "pending" | "uploading" | "done" | "error"
}

interface DrawerState {
  open: boolean
  filePath: string | null
  content: string | null
  loadingContent: boolean
  editing: boolean
  editContent: string
  saving: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getChildren(items: ArtifactItem[], parentPath: string[]): ArtifactItem[] {
  const prefix = parentPath.length > 0 ? parentPath.join("/") + "/" : ""
  if (!prefix) {
    return items.filter(i => !i.path.includes("/"))
  }
  return items
    .filter(i => i.path.startsWith(prefix))
    .filter(i => !i.path.slice(prefix.length).includes("/"))
}

async function readDirEntry(entry: FileSystemDirectoryEntry, prefix: string): Promise<File[]> {
  const result: File[] = []
  const reader = entry.createReader()
  const entries = await new Promise<FileSystemEntry[]>((resolve, reject) =>
    reader.readEntries(resolve, reject)
  )
  for (const e of entries) {
    if (e.isFile) {
      const f = await new Promise<File>(resolve => (e as FileSystemFileEntry).file(resolve))
      result.push(new File([f], `${prefix}/${f.name}`, { type: f.type }))
    } else if (e.isDirectory) {
      const sub = await readDirEntry(e as FileSystemDirectoryEntry, `${prefix}/${e.name}`)
      result.push(...sub)
    }
  }
  return result
}

export function ProjectArtifactsPage() {
  const { slug } = useParams({ from: "/_auth/projects/$slug/artifacts" })

  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPath, setCurrentPath] = useState<string[]>([])

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [showUpload, setShowUpload] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  const [drawer, setDrawer] = useState<DrawerState>({
    open: false,
    filePath: null,
    content: null,
    loadingContent: false,
    editing: false,
    editContent: "",
    saving: false,
  })

  const [colorMode, setColorMode] = useState<"light" | "dark">("light")

  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark")
    setColorMode(isDark ? "dark" : "light")
  }, [])

  const fetchArtifacts = useCallback(() => {
    setLoading(true)
    apiFetch(`/api/v1/projects/${slug}/artifacts`)
      .then(r => r.json() as Promise<ArtifactItem[]>)
      .then(setArtifacts)
      .catch(() => setArtifacts([]))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    fetchArtifacts()
  }, [fetchArtifacts])

  const children = getChildren(artifacts, currentPath)
  const sortedChildren = [
    ...children.filter(i => i.type === "dir").sort((a, b) => a.path.localeCompare(b.path)),
    ...children.filter(i => i.type === "file").sort((a, b) => a.path.localeCompare(b.path)),
  ]
  const displayName = (item: ArtifactItem) => {
    const prefix = currentPath.length > 0 ? currentPath.join("/") + "/" : ""
    return item.path.slice(prefix.length)
  }

  const allCurrentPaths = sortedChildren.map(i => i.path)
  const allSelected = allCurrentPaths.length > 0 && allCurrentPaths.every(p => selected.has(p))
  const toggleAll = () => {
    if (allSelected) {
      setSelected(prev => {
        const next = new Set(prev)
        allCurrentPaths.forEach(p => next.delete(p))
        return next
      })
    } else {
      setSelected(prev => new Set([...prev, ...allCurrentPaths]))
    }
  }
  const toggleItem = (p: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const deleteItem = async (itemPath: string) => {
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/projects/${slug}/artifacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: [itemPath] }),
      })
      setConfirmDelete(null)
      setSelected(prev => {
        const next = new Set(prev)
        next.delete(itemPath)
        return next
      })
      fetchArtifacts()
    } finally {
      setDeleting(false)
    }
  }

  const deleteSelected = async () => {
    setDeleting(true)
    try {
      await apiFetch(`/api/v1/projects/${slug}/artifacts`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths: Array.from(selected) }),
      })
      setSelected(new Set())
      setShowDeleteModal(false)
      fetchArtifacts()
    } finally {
      setDeleting(false)
    }
  }

  const addPendingFiles = (files: File[]) => {
    const pending: PendingFile[] = files.map(f => ({
      file: f,
      relativePath: f.name,
      status: "pending",
    }))
    setPendingFiles(prev => [...prev, ...pending])
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const withPaths: File[] = files.map(f => {
      const rel = f.webkitRelativePath || f.name
      return rel !== f.name ? new File([f], rel, { type: f.type }) : f
    })
    addPendingFiles(withPaths)
    e.target.value = ""
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const items = Array.from(e.dataTransfer.items)
    const collected: File[] = []
    for (const item of items) {
      const entry = item.webkitGetAsEntry()
      if (!entry) continue
      if (entry.isFile) {
        const f = await new Promise<File>(resolve => (entry as FileSystemFileEntry).file(resolve))
        collected.push(f)
      } else if (entry.isDirectory) {
        const sub = await readDirEntry(entry as FileSystemDirectoryEntry, entry.name)
        collected.push(...sub)
      }
    }
    addPendingFiles(collected)
  }

  const uploadAll = async () => {
    if (pendingFiles.length === 0) return
    setUploading(true)
    setPendingFiles(prev => prev.map(f => ({ ...f, status: "uploading" as const })))
    try {
      const fd = new FormData()
      for (const pf of pendingFiles) {
        fd.append("file", pf.file, pf.file.name)
      }
      const res = await apiFetch(`/api/v1/projects/${slug}/artifacts`, {
        method: "POST",
        body: fd,
      })
      if (res.ok) {
        setPendingFiles([])
        setShowUpload(false)
        fetchArtifacts()
      } else {
        setPendingFiles(prev => prev.map(f => ({ ...f, status: "error" as const })))
      }
    } catch {
      setPendingFiles(prev => prev.map(f => ({ ...f, status: "error" as const })))
    } finally {
      setUploading(false)
    }
  }

  const openDrawer = async (filePath: string) => {
    setDrawer({
      open: true,
      filePath,
      content: null,
      loadingContent: true,
      editing: false,
      editContent: "",
      saving: false,
    })
    const ext = filePath.split(".").pop()?.toLowerCase()
    if (ext === "md" || ext === "txt") {
      try {
        const res = await apiFetch(`/api/v1/projects/${slug}/artifacts/${filePath}`)
        if (res.ok) {
          const text = await res.text()
          setDrawer(d => ({ ...d, content: text, loadingContent: false }))
        } else {
          setDrawer(d => ({ ...d, content: null, loadingContent: false }))
        }
      } catch {
        setDrawer(d => ({ ...d, content: null, loadingContent: false }))
      }
    } else {
      setDrawer(d => ({ ...d, loadingContent: false }))
    }
  }

  const closeDrawer = () => {
    setDrawer(d => ({ ...d, open: false }))
  }

  const startEdit = () => {
    setDrawer(d => ({ ...d, editing: true, editContent: d.content ?? "" }))
  }

  const cancelEdit = () => {
    setDrawer(d => ({ ...d, editing: false }))
  }

  const saveEdit = async () => {
    if (!drawer.filePath) return
    setDrawer(d => ({ ...d, saving: true }))
    try {
      const res = await apiFetch(`/api/v1/projects/${slug}/artifacts/${drawer.filePath}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: drawer.editContent }),
      })
      if (res.ok) {
        setDrawer(d => ({ ...d, content: d.editContent, editing: false, saving: false }))
      } else {
        setDrawer(d => ({ ...d, saving: false }))
      }
    } catch {
      setDrawer(d => ({ ...d, saving: false }))
    }
  }

  const drawerExt = drawer.filePath?.split(".").pop()?.toLowerCase()
  const isEditable = drawerExt === "md" || drawerExt === "txt"
  const drawerFileName = drawer.filePath?.split("/").pop() ?? ""

  return (
    <div className="flex flex-col p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/projects/$slug/info"
          params={{ slug }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Projeto
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-semibold">Artefatos — {slug}</h1>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowUpload(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Upload
        </button>
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={selected.size === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir Selecionados ({selected.size})
        </button>
      </div>

      {/* Upload area */}
      {showUpload && (
        <div className="mb-4 border rounded-lg overflow-hidden">
          <div
            className={`border-2 border-dashed rounded-lg m-3 p-8 flex flex-col items-center gap-3 transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/30"
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center">
              Arraste arquivos ou pastas aqui, ou clique para selecionar
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
              >
                Arquivos
              </button>
              <button
                type="button"
                onClick={() => dirInputRef.current?.click()}
                className="px-3 py-1.5 rounded-md border text-sm hover:bg-muted transition-colors"
              >
                Pasta
              </button>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
            {/* @ts-expect-error webkitdirectory not in types */}
            <input ref={dirInputRef} type="file" webkitdirectory="" className="hidden" onChange={handleFileInput} />
          </div>

          {pendingFiles.length > 0 && (
            <div className="px-3 pb-3 flex flex-col gap-2">
              <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
                {pendingFiles.map((pf, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                    <span className="font-mono truncate flex-1">{pf.file.name}</span>
                    <span className="text-muted-foreground shrink-0">{formatSize(pf.file.size)}</span>
                    {pf.status === "uploading" && (
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden shrink-0">
                        <div className="h-full bg-primary rounded-full animate-pulse w-full" />
                      </div>
                    )}
                    {pf.status === "done" && <span className="text-green-600 shrink-0">✓</span>}
                    {pf.status === "error" && <span className="text-destructive shrink-0">✗</span>}
                    {pf.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => setPendingFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={uploadAll}
                disabled={uploading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors self-end"
              >
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                Enviar todos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm mb-3 flex-wrap">
        <button
          onClick={() => setCurrentPath([])}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          artifacts
        </button>
        {currentPath.map((seg, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            <button
              onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}
              className={i === currentPath.length - 1 ? "font-medium" : "text-muted-foreground hover:text-foreground transition-colors"}
            >
              {seg}
            </button>
          </span>
        ))}
      </nav>

      {/* File list */}
      <div className="border rounded-lg overflow-hidden">
        {/* List header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-muted/30 border-b text-xs font-medium text-muted-foreground">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="shrink-0"
          />
          <span className="flex-1">Nome</span>
          <span className="w-20 text-right">Tamanho</span>
          <span className="w-16 text-right">Ações</span>
        </div>

        {loading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map(i => <div key={i} className="h-8 bg-muted rounded animate-pulse" />)}
          </div>
        ) : sortedChildren.length === 0 ? (
          <p className="text-sm text-muted-foreground p-6 text-center">
            {currentPath.length === 0 ? "Nenhum artefato encontrado." : "Pasta vazia."}
          </p>
        ) : (
          sortedChildren.map(item => {
            const name = displayName(item)
            const isConfirming = confirmDelete === item.path
            return (
              <div
                key={item.path}
                className="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 hover:bg-muted/30 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.has(item.path)}
                  onChange={() => toggleItem(item.path)}
                  className="shrink-0"
                />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {item.type === "dir" ? (
                    <Folder className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <FileIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <button
                    className={`font-mono text-xs truncate text-left ${
                      item.type === "dir"
                        ? "hover:underline cursor-pointer"
                        : "hover:underline cursor-pointer"
                    }`}
                    onClick={() => {
                      if (item.type === "dir") {
                        setCurrentPath(item.path.split("/"))
                      } else {
                        void openDrawer(item.path)
                      }
                    }}
                  >
                    {name}
                  </button>
                </div>
                <span className="w-20 text-right text-xs text-muted-foreground shrink-0">
                  {item.type === "file" && item.size !== undefined ? formatSize(item.size) : "—"}
                </span>
                <div className="w-16 flex items-center justify-end gap-1 shrink-0">
                  {isConfirming ? (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted-foreground">Confirmar?</span>
                      <button
                        onClick={() => void deleteItem(item.path)}
                        disabled={deleting}
                        className="text-destructive hover:underline font-medium disabled:opacity-50"
                      >
                        Sim
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="text-muted-foreground hover:underline"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <>
                      {item.type === "file" && (
                        <a
                          href={`/api/v1/projects/${slug}/artifacts/${item.path}`}
                          download={name}
                          className="p-1 rounded hover:bg-muted text-muted-foreground"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => setConfirmDelete(item.path)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Bulk delete modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            className="bg-background border rounded-lg shadow-xl max-w-md w-full p-6 flex flex-col gap-4"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-semibold text-sm">Confirmar exclusão</h2>
            <p className="text-sm text-muted-foreground">
              Os seguintes itens serão excluídos permanentemente:
            </p>
            <ul className="text-xs font-mono bg-muted/50 rounded p-3 max-h-40 overflow-y-auto flex flex-col gap-1">
              {Array.from(selected).map(p => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="px-4 py-2 rounded border text-sm hover:bg-muted transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void deleteSelected()}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File drawer */}
      {drawer.open && (
        <div
          className="fixed inset-0 bg-black/40 z-50"
          onClick={closeDrawer}
        />
      )}
      <div
        className={`fixed inset-y-0 right-0 w-[480px] max-w-full bg-background border-l shadow-xl transition-transform duration-300 z-50 flex flex-col ${
          drawer.open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {drawer.filePath && (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
              <span className="font-mono text-sm truncate">{drawerFileName}</span>
              <div className="flex items-center gap-2">
                {isEditable && !drawer.editing && !drawer.loadingContent && drawer.content !== null && (
                  <button
                    onClick={startEdit}
                    className="flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-muted transition-colors"
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={closeDrawer}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {drawer.loadingContent ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : drawer.editing ? (
                <div className="flex flex-col gap-3 h-full">
                  {drawerExt === "md" ? (
                    <div data-color-mode={colorMode} className="flex-1">
                      <MDEditor
                        value={drawer.editContent}
                        onChange={v => setDrawer(d => ({ ...d, editContent: v ?? "" }))}
                        height={400}
                      />
                    </div>
                  ) : (
                    <textarea
                      value={drawer.editContent}
                      onChange={e => setDrawer(d => ({ ...d, editContent: e.target.value }))}
                      className="flex-1 font-mono text-xs border rounded p-3 bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none min-h-[400px]"
                    />
                  )}
                  <div className="flex gap-2 justify-end shrink-0">
                    <button
                      onClick={cancelEdit}
                      disabled={drawer.saving}
                      className="px-3 py-1.5 rounded border text-sm hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => void saveEdit()}
                      disabled={drawer.saving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {drawer.saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Salvar
                    </button>
                  </div>
                </div>
              ) : isEditable && drawer.content !== null ? (
                drawerExt === "md" ? (
                  <MarkdownViewer content={drawer.content} />
                ) : (
                  <pre className="text-xs font-mono whitespace-pre-wrap">{drawer.content}</pre>
                )
              ) : (
                <div className="flex flex-col items-center gap-4 py-8 text-muted-foreground">
                  <FileIcon className="w-12 h-12" />
                  <p className="text-sm">{drawerFileName}</p>
                  <a
                    href={`/api/v1/projects/${slug}/artifacts/${drawer.filePath}`}
                    download={drawerFileName}
                    className="flex items-center gap-1.5 px-4 py-2 rounded border text-sm hover:bg-muted transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </a>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

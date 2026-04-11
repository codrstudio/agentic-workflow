import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  Plus,
  Star,
  AlertTriangle,
  LayoutGrid,
  List as ListIcon,
  FolderPlus,
  ChevronLeft,
  MoreVertical,
  Trash2,
  Pencil,
  X,
  Check,
} from "lucide-react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { apiFetch } from "@/lib/api"
import { StatusBadge } from "@workspace/ui/components/status-badge"
import { FolderDialog } from "@/components/folder-dialog"
import { ConfirmDialog } from "@/components/confirm-dialog"
import { PopoverMenu } from "@/components/popover-menu"
import { getFolderIcon } from "@/lib/folder-icons"

interface Project {
  name: string
  slug: string
  description?: string
  status?: string
}

interface Folder {
  id: string
  name: string
  icon?: string
  order: number
  projects: string[]
}

interface ActiveRun {
  slug: string
  wave_status?: string | null
  last_output_age_ms?: number | null
}

type ViewMode = "grid" | "list"

const STUCK_THRESHOLD_MS = 5 * 60_000
const VIEW_KEY = "aw_projects_view"
const FAV_KEY = "aw_favorites_slugs"
const FAVORITES_ID = "__favorites__"

function loadFavSlugs(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
    const legacy = localStorage.getItem("aw_favorites")
    if (legacy) {
      const arr = JSON.parse(legacy) as Array<{ slug: string }>
      const migrated = new Set(arr.map((x) => x.slug))
      localStorage.setItem(FAV_KEY, JSON.stringify([...migrated]))
      return migrated
    }
    return new Set()
  } catch {
    return new Set()
  }
}

function saveFavSlugs(slugs: Set<string>) {
  localStorage.setItem(FAV_KEY, JSON.stringify([...slugs]))
}

function loadView(): ViewMode {
  return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "grid"
}

function runDotClasses(active: boolean) {
  return active ? "relative flex h-2.5 w-2.5 shrink-0" : "hidden"
}

// ───────────────────────────────────────────── Header ─────────────────────────

function Header({
  view,
  onViewChange,
  onNewFolder,
}: {
  view: ViewMode
  onViewChange: (v: ViewMode) => void
  onNewFolder: () => void
}) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-between mb-6 gap-3">
      <h1 className="text-xl font-semibold">Projetos</h1>
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-md border bg-card p-0.5">
          <button
            onClick={() => onViewChange("grid")}
            aria-pressed={view === "grid"}
            className={`px-2 py-1 rounded transition-colors ${
              view === "grid" ? "bg-muted" : "hover:bg-muted/50"
            }`}
            aria-label="Visão em painel"
            title="Painel"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onViewChange("list")}
            aria-pressed={view === "list"}
            className={`px-2 py-1 rounded transition-colors ${
              view === "list" ? "bg-muted" : "hover:bg-muted/50"
            }`}
            aria-label="Visão em lista"
            title="Lista"
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={onNewFolder}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium hover:bg-muted transition-colors"
          title="Nova pasta"
        >
          <FolderPlus className="w-4 h-4" />
          Nova pasta
        </button>
        <button
          onClick={() => navigate({ to: "/projects/new" })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Projeto
        </button>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────── Folder menu (⋯) ────────────────

function FolderActionsMenu({
  onEdit,
  onDelete,
  className = "",
}: {
  onEdit: () => void
  onDelete: () => void
  className?: string
}) {
  return (
    <PopoverMenu
      align="right"
      width="min-w-40"
      trigger={({ onClick }) => (
        <button
          onClick={onClick}
          className={`p-1 rounded hover:bg-muted transition-colors ${className}`}
          aria-label="Menu da pasta"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <button
            onClick={() => {
              close()
              onEdit()
            }}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted w-full text-left"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            onClick={() => {
              close()
              onDelete()
            }}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted w-full text-left text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </button>
        </>
      )}
    </PopoverMenu>
  )
}

// ───────────────────────────────────────────── Folder tiles ───────────────────

function FolderTile({
  folder,
  isFavorites,
  count,
  onOpen,
  onEdit,
  onDelete,
}: {
  folder: { id: string; name: string; icon?: string }
  isFavorites: boolean
  count: number
  onOpen: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: "folder", folderId: folder.id },
  })
  const Icon = isFavorites ? Star : getFolderIcon(folder.icon)
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={`group relative bg-card border rounded-lg p-4 cursor-pointer transition-all select-none ${
        isOver
          ? "border-primary border-2 bg-primary/5 scale-[1.02]"
          : "hover:border-foreground/30 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            className={`w-5 h-5 shrink-0 ${isFavorites ? "" : "text-muted-foreground"}`}
            {...(isFavorites ? { fill: "#eab308", stroke: "#eab308" } : {})}
          />
          <h3 className="font-medium text-sm truncate">{folder.name}</h3>
        </div>
        {!isFavorites && onEdit && onDelete && (
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <FolderActionsMenu onEdit={onEdit} onDelete={onDelete} />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {count} {count === 1 ? "projeto" : "projetos"}
      </p>
    </div>
  )
}

function FolderListRow({
  folder,
  isFavorites,
  count,
  onOpen,
  onEdit,
  onDelete,
}: {
  folder: { id: string; name: string; icon?: string }
  isFavorites: boolean
  count: number
  onOpen: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `folder:${folder.id}`,
    data: { type: "folder", folderId: folder.id },
  })
  const Icon = isFavorites ? Star : getFolderIcon(folder.icon)
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={`flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer transition-colors ${
        isOver ? "bg-primary/10 border-primary" : "hover:bg-muted/50"
      }`}
    >
      <Icon
        className={`w-4 h-4 shrink-0 ${isFavorites ? "" : "text-muted-foreground"}`}
        {...(isFavorites ? { fill: "#eab308", stroke: "#eab308" } : {})}
      />
      <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>
      <span className="text-xs text-muted-foreground">
        {count} {count === 1 ? "projeto" : "projetos"}
      </span>
      {!isFavorites && onEdit && onDelete && (
        <div onClick={(e) => e.stopPropagation()}>
          <FolderActionsMenu onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  )
}

// ───────────────────────────────────────────── Project menu (⋯) ───────────────

function ProjectActionsMenu({
  slug,
  folders,
  isFavorite,
  currentFolderId,
  onToggleFavorite,
  onToggleFolder,
  onRemoveFromCurrent,
}: {
  slug: string
  folders: Folder[]
  isFavorite: boolean
  currentFolderId: string | null
  onToggleFavorite: () => void
  onToggleFolder: (folderId: string, currentlyIn: boolean) => void
  onRemoveFromCurrent?: () => void
}) {
  const showRemoveOption =
    currentFolderId !== null && currentFolderId !== FAVORITES_ID && !!onRemoveFromCurrent
  return (
    <PopoverMenu
      align="right"
      width="min-w-56"
      trigger={({ onClick }) => (
        <button
          onClick={onClick}
          className="p-0.5 rounded hover:bg-muted transition-colors"
          aria-label="Mover para pasta"
          title="Mover para..."
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Pastas
          </div>
          <button
            onClick={() => {
              onToggleFavorite()
              close()
            }}
            className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-muted text-left"
          >
            <Star
              className="w-4 h-4 shrink-0"
              fill={isFavorite ? "#eab308" : "none"}
              stroke={isFavorite ? "#eab308" : "currentColor"}
            />
            <span className="flex-1 truncate">Favoritos</span>
            {isFavorite && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
          </button>
          {folders.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Nenhuma pasta criada
            </div>
          ) : (
            folders.map((f) => {
              const Icon = getFolderIcon(f.icon)
              const inside = f.projects.includes(slug)
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    onToggleFolder(f.id, inside)
                    close()
                  }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-muted text-left"
                >
                  <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{f.name}</span>
                  {inside && <Check className="w-3.5 h-3.5 shrink-0 text-primary" />}
                </button>
              )
            })
          )}
          {showRemoveOption && (
            <>
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  onRemoveFromCurrent?.()
                  close()
                }}
                className="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-muted text-left text-destructive"
              >
                <X className="w-3.5 h-3.5 shrink-0" />
                <span className="flex-1">Remover desta pasta</span>
              </button>
            </>
          )}
        </>
      )}
    </PopoverMenu>
  )
}

// ───────────────────────────────────────────── Project cards ──────────────────

function ProjectCard({
  project,
  isFavorite,
  activeRun,
  folders,
  currentFolderId,
  onToggleFavorite,
  onToggleFolder,
  onRemoveFromCurrent,
  onOpen,
}: {
  project: Project
  isFavorite: boolean
  activeRun: ActiveRun | undefined
  folders: Folder[]
  currentFolderId: string | null
  onToggleFavorite: (slug: string) => void
  onToggleFolder: (slug: string, folderId: string, currentlyIn: boolean) => void
  onRemoveFromCurrent: (slug: string) => void
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `project:${project.slug}`,
    data: { type: "project", slug: project.slug },
  })
  const isActive = !!activeRun
  const isStuck =
    isActive &&
    activeRun.last_output_age_ms != null &&
    activeRun.last_output_age_ms > STUCK_THRESHOLD_MS

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return
        if ((e.target as HTMLElement).closest("button")) return
        onOpen()
      }}
      className={`block bg-card border rounded-lg p-5 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isDragging ? "opacity-40" : "hover:border-foreground/30 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={runDotClasses(isActive)}>
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
          </span>
          <h2 className="font-medium text-sm leading-snug truncate">{project.name}</h2>
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
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite(project.slug)
            }}
            className="p-0.5 rounded transition-colors"
            aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star
              className="w-4 h-4"
              fill={isFavorite ? "#eab308" : "none"}
              stroke={isFavorite ? "#eab308" : "currentColor"}
            />
          </button>
          <ProjectActionsMenu
            slug={project.slug}
            folders={folders}
            isFavorite={isFavorite}
            currentFolderId={currentFolderId}
            onToggleFavorite={() => onToggleFavorite(project.slug)}
            onToggleFolder={(fid, inside) => onToggleFolder(project.slug, fid, inside)}
            onRemoveFromCurrent={() => onRemoveFromCurrent(project.slug)}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs font-mono mb-2">{project.slug}</p>
      {project.description && (
        <p className="text-muted-foreground text-xs line-clamp-2">{project.description}</p>
      )}
    </div>
  )
}

function ProjectRow({
  project,
  isFavorite,
  activeRun,
  folders,
  currentFolderId,
  onToggleFavorite,
  onToggleFolder,
  onRemoveFromCurrent,
  onOpen,
}: {
  project: Project
  isFavorite: boolean
  activeRun: ActiveRun | undefined
  folders: Folder[]
  currentFolderId: string | null
  onToggleFavorite: (slug: string) => void
  onToggleFolder: (slug: string, folderId: string, currentlyIn: boolean) => void
  onRemoveFromCurrent: (slug: string) => void
  onOpen: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `project:${project.slug}`,
    data: { type: "project", slug: project.slug },
  })
  const isActive = !!activeRun
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return
        if ((e.target as HTMLElement).closest("button")) return
        onOpen()
      }}
      className={`flex items-center gap-3 px-3 py-2.5 border-b cursor-pointer transition-colors ${
        isDragging ? "opacity-40" : "hover:bg-muted/50"
      }`}
    >
      <span className={runDotClasses(isActive)}>
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{project.name}</div>
        <div className="text-xs font-mono text-muted-foreground truncate">{project.slug}</div>
      </div>
      {project.description && (
        <div className="hidden lg:block flex-1 min-w-0 text-xs text-muted-foreground truncate">
          {project.description}
        </div>
      )}
      <div className="flex items-center gap-1 shrink-0">
        {isActive && activeRun.wave_status ? (
          <StatusBadge status={activeRun.wave_status} />
        ) : (
          <StatusBadge status={project.status} />
        )}
        <button
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onToggleFavorite(project.slug)
          }}
          className="p-0.5 rounded"
          aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Star
            className="w-4 h-4"
            fill={isFavorite ? "#eab308" : "none"}
            stroke={isFavorite ? "#eab308" : "currentColor"}
          />
        </button>
        <ProjectActionsMenu
          slug={project.slug}
          folders={folders}
          isFavorite={isFavorite}
          currentFolderId={currentFolderId}
          onToggleFavorite={() => onToggleFavorite(project.slug)}
          onToggleFolder={(fid, inside) => onToggleFolder(project.slug, fid, inside)}
          onRemoveFromCurrent={() => onRemoveFromCurrent(project.slug)}
        />
      </div>
    </div>
  )
}

// ───────────────────────────────────────────── Remove dropzone ────────────────

function RemoveDropZone({ folderName }: { folderName: string }) {
  const { setNodeRef, isOver } = useDroppable({
    id: "remove-from-folder",
    data: { type: "remove" },
  })
  return (
    <div
      ref={setNodeRef}
      className={`mb-4 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-lg text-sm transition-colors ${
        isOver
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-muted-foreground/30 text-muted-foreground"
      }`}
    >
      <X className="w-4 h-4" />
      Solte aqui para remover de "{folderName}"
    </div>
  )
}

// ───────────────────────────────────────────── Main page ──────────────────────

export function ProjectsPage() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { folder?: string }
  const currentFolderId: string | null = search.folder ?? null

  function setCurrentFolderId(next: string | null) {
    navigate({
      to: "/projects",
      search: next ? { folder: next } : {},
    })
  }

  const [projects, setProjects] = useState<Project[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [favSlugs, setFavSlugs] = useState<Set<string>>(() => loadFavSlugs())
  const [view, setView] = useState<ViewMode>(() => loadView())
  const [loading, setLoading] = useState(true)
  const [activeRunsMap, setActiveRunsMap] = useState<Map<string, ActiveRun>>(new Map())
  const [draggingSlug, setDraggingSlug] = useState<string | null>(null)

  // Dialog state
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)
  const [folderEditing, setFolderEditing] = useState<Folder | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Folder | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view)
  }, [view])

  useEffect(() => {
    Promise.all([
      apiFetch("/api/v1/projects?offset=0&limit=500").then((r) => r.json()),
      apiFetch("/api/v1/folders").then((r) => r.json()),
    ])
      .then(([projectsData, foldersData]) => {
        setProjects((projectsData.projects ?? []) as Project[])
        setFolders((foldersData.folders ?? []) as Folder[])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    apiFetch("/api/v1/runs/active")
      .then((r) => r.json() as Promise<ActiveRun[]>)
      .then((runs) => setActiveRunsMap(new Map(runs.map((r) => [r.slug, r]))))
      .catch(() => undefined)
  }, [])

  async function refreshFolders() {
    const data = await apiFetch("/api/v1/folders").then((r) => r.json())
    setFolders((data.folders ?? []) as Folder[])
  }

  function toggleFavorite(slug: string) {
    setFavSlugs((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      saveFavSlugs(next)
      return next
    })
  }

  function openCreateFolder() {
    setFolderEditing(null)
    setFolderDialogOpen(true)
  }

  function openEditFolder(folder: Folder) {
    setFolderEditing(folder)
    setFolderDialogOpen(true)
  }

  async function handleFolderSubmit(data: { name: string; icon: string }) {
    if (folderEditing) {
      await apiFetch(`/api/v1/folders/${folderEditing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    } else {
      await apiFetch("/api/v1/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
    }
    await refreshFolders()
  }

  async function handleDeleteFolder() {
    if (!deleteConfirm) return
    await apiFetch(`/api/v1/folders/${deleteConfirm.id}`, { method: "DELETE" })
    if (currentFolderId === deleteConfirm.id) setCurrentFolderId(null)
    await refreshFolders()
  }

  async function addProjectToFolder(slug: string, folderId: string) {
    if (folderId === FAVORITES_ID) {
      if (!favSlugs.has(slug)) toggleFavorite(slug)
      return
    }
    await apiFetch(`/api/v1/folders/${folderId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    })
    await refreshFolders()
  }

  async function removeProjectFromFolder(slug: string, folderId: string) {
    if (folderId === FAVORITES_ID) {
      if (favSlugs.has(slug)) toggleFavorite(slug)
      return
    }
    await apiFetch(`/api/v1/folders/${folderId}/projects/${slug}`, { method: "DELETE" })
    await refreshFolders()
  }

  async function toggleProjectInFolder(slug: string, folderId: string, currentlyIn: boolean) {
    if (currentlyIn) {
      await removeProjectFromFolder(slug, folderId)
    } else {
      await addProjectToFolder(slug, folderId)
    }
  }

  async function removeProjectFromCurrent(slug: string) {
    if (!currentFolderId) return
    await removeProjectFromFolder(slug, currentFolderId)
  }

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { type?: string; slug?: string } | undefined
    if (data?.type === "project" && data.slug) setDraggingSlug(data.slug)
  }

  async function handleDragEnd(e: DragEndEvent) {
    setDraggingSlug(null)
    const { active, over } = e
    if (!over) return
    const activeData = active.data.current as { type?: string; slug?: string } | undefined
    if (activeData?.type !== "project" || !activeData.slug) return
    const overData = over.data.current as { type?: string; folderId?: string } | undefined
    if (overData?.type === "folder" && overData.folderId) {
      await addProjectToFolder(activeData.slug, overData.folderId)
    } else if (overData?.type === "remove" && currentFolderId) {
      await removeProjectFromFolder(activeData.slug, currentFolderId)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const projectsBySlug = useMemo(
    () => new Map(projects.map((p) => [p.slug, p])),
    [projects]
  )

  const slugsInSomeFolder = useMemo(() => {
    const s = new Set<string>()
    for (const f of folders) for (const slug of f.projects) s.add(slug)
    return s
  }, [folders])

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.order - b.order),
    [folders]
  )

  const currentFolder = useMemo(() => {
    if (!currentFolderId || currentFolderId === FAVORITES_ID) return null
    return folders.find((f) => f.id === currentFolderId) ?? null
  }, [currentFolderId, folders])

  const rootLooseProjects = useMemo(
    () =>
      projects
        .filter((p) => !slugsInSomeFolder.has(p.slug))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [projects, slugsInSomeFolder]
  )

  const favoriteProjects = useMemo(
    () =>
      [...favSlugs]
        .map((slug) => projectsBySlug.get(slug))
        .filter((p): p is Project => !!p)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [favSlugs, projectsBySlug]
  )

  const currentFolderProjects = useMemo(() => {
    if (!currentFolder) return []
    return currentFolder.projects
      .map((slug) => projectsBySlug.get(slug))
      .filter((p): p is Project => !!p)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [currentFolder, projectsBySlug])

  const viewingProjects: Project[] =
    currentFolderId === FAVORITES_ID
      ? favoriteProjects
      : currentFolder
        ? currentFolderProjects
        : rootLooseProjects

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col p-6">
        <Header view={view} onViewChange={setView} onNewFolder={openCreateFolder} />
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

  const draggingProject = draggingSlug ? projectsBySlug.get(draggingSlug) : null
  const inFolderView = currentFolderId !== null
  const currentFolderName =
    currentFolderId === FAVORITES_ID
      ? "Favoritos"
      : (currentFolder?.name ?? "")

  function onProjectOpen(slug: string) {
    navigate({ to: "/projects/$slug/info", params: { slug } })
  }

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex flex-col p-6">
          <Header view={view} onViewChange={setView} onNewFolder={openCreateFolder} />

          {inFolderView && (
            <div className="flex items-center gap-2 mb-4 text-sm">
              <button
                onClick={() => setCurrentFolderId(null)}
                className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Projetos
              </button>
              <span className="text-muted-foreground">/</span>
              <span className="font-medium">{currentFolderName}</span>
            </div>
          )}

          {inFolderView && draggingSlug && <RemoveDropZone folderName={currentFolderName} />}

          {/* Folders section (only on root view) */}
          {!inFolderView && (
            <section className="mb-8">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Pastas
              </h2>
              {view === "grid" ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <FolderTile
                    folder={{ id: FAVORITES_ID, name: "Favoritos" }}
                    isFavorites
                    count={favoriteProjects.length}
                    onOpen={() => setCurrentFolderId(FAVORITES_ID)}
                  />
                  {sortedFolders.map((f) => (
                    <FolderTile
                      key={f.id}
                      folder={f}
                      isFavorites={false}
                      count={f.projects.length}
                      onOpen={() => setCurrentFolderId(f.id)}
                      onEdit={() => openEditFolder(f)}
                      onDelete={() => setDeleteConfirm(f)}
                    />
                  ))}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden bg-card">
                  <FolderListRow
                    folder={{ id: FAVORITES_ID, name: "Favoritos" }}
                    isFavorites
                    count={favoriteProjects.length}
                    onOpen={() => setCurrentFolderId(FAVORITES_ID)}
                  />
                  {sortedFolders.map((f) => (
                    <FolderListRow
                      key={f.id}
                      folder={f}
                      isFavorites={false}
                      count={f.projects.length}
                      onOpen={() => setCurrentFolderId(f.id)}
                      onEdit={() => openEditFolder(f)}
                      onDelete={() => setDeleteConfirm(f)}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Projects section */}
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {inFolderView ? "Projetos nesta pasta" : "Projetos"}
            </h2>
            {viewingProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card/50">
                <p className="text-muted-foreground text-sm">
                  {inFolderView
                    ? "Esta pasta está vazia. Arraste projetos até ela ou use o menu ⋯ do card."
                    : "Nenhum projeto solto. Adicione em context/projects/."}
                </p>
              </div>
            ) : view === "grid" ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {viewingProjects.map((project) => (
                  <ProjectCard
                    key={project.slug}
                    project={project}
                    isFavorite={favSlugs.has(project.slug)}
                    activeRun={activeRunsMap.get(project.slug)}
                    folders={sortedFolders}
                    currentFolderId={currentFolderId}
                    onToggleFavorite={toggleFavorite}
                    onToggleFolder={toggleProjectInFolder}
                    onRemoveFromCurrent={removeProjectFromCurrent}
                    onOpen={() => onProjectOpen(project.slug)}
                  />
                ))}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden bg-card">
                {viewingProjects.map((project) => (
                  <ProjectRow
                    key={project.slug}
                    project={project}
                    isFavorite={favSlugs.has(project.slug)}
                    activeRun={activeRunsMap.get(project.slug)}
                    folders={sortedFolders}
                    currentFolderId={currentFolderId}
                    onToggleFavorite={toggleFavorite}
                    onToggleFolder={toggleProjectInFolder}
                    onRemoveFromCurrent={removeProjectFromCurrent}
                    onOpen={() => onProjectOpen(project.slug)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <DragOverlay>
          {draggingProject ? (
            <div className="bg-card border-2 border-primary rounded-lg p-3 shadow-lg text-sm font-medium max-w-xs">
              {draggingProject.name}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <FolderDialog
        open={folderDialogOpen}
        onClose={() => setFolderDialogOpen(false)}
        onSubmit={handleFolderSubmit}
        folder={folderEditing}
      />

      <ConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteFolder}
        title="Excluir pasta"
        destructive
        confirmLabel="Excluir"
        message={
          <>
            Tem certeza que deseja excluir a pasta{" "}
            <span className="font-medium text-foreground">
              "{deleteConfirm?.name}"
            </span>
            ? Os projetos dentro dela não serão apagados — apenas perderão esta
            etiqueta.
          </>
        }
      />
    </>
  )
}

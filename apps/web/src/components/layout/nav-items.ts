import { useRouterState } from "@tanstack/react-router"
import {
  ArrowLeft,
  FolderKanban,
  LayoutDashboard,
  FileText,
  Waves,
  Terminal,
  ListChecks,
  Activity,
  OctagonX,
  BookOpen,
  Workflow,
  ClipboardList,
  Bot,
  SlidersHorizontal,
} from "lucide-react"
import type { ComponentType } from "react"

export interface NavItemDef {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const GLOBAL_NAV_ITEMS: NavItemDef[] = [
  { to: "/projects", label: "Projetos", icon: FolderKanban },
  { to: "/library/workflows", label: "Biblioteca", icon: BookOpen },
]

function projectNavItems(slug: string): NavItemDef[] {
  return [
    { to: "/projects", label: "Voltar", icon: ArrowLeft },
    { to: `/projects/${slug}`, label: "Dashboard", icon: LayoutDashboard },
    { to: `/projects/${slug}/info`, label: "Projeto", icon: FileText },
    { to: `/projects/${slug}/monitor`, label: "Monitor", icon: Activity },
    { to: `/projects/${slug}/waves`, label: "Waves", icon: Waves },
    { to: `/projects/${slug}/console`, label: "Console", icon: Terminal },
    { to: `/projects/${slug}/sprints`, label: "Sprints", icon: ListChecks },
    { to: `/projects/${slug}/crashes`, label: "Crashes", icon: OctagonX },
  ]
}

const LIBRARY_NAV_ITEMS: NavItemDef[] = [
  { to: "/projects", label: "Voltar", icon: ArrowLeft },
  { to: "/library/workflows", label: "Workflows", icon: Workflow },
  { to: "/library/tasks", label: "Tasks", icon: ClipboardList },
  { to: "/library/agents", label: "Agents", icon: Bot },
  { to: "/library/plans", label: "Plans", icon: SlidersHorizontal },
]

export function useNavItems(): NavItemDef[] {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  if (pathname.startsWith("/library")) {
    return LIBRARY_NAV_ITEMS
  }

  const match = pathname.match(/^\/projects\/([^/]+)/)
  if (match && match[1]) {
    return projectNavItems(match[1])
  }

  return GLOBAL_NAV_ITEMS
}

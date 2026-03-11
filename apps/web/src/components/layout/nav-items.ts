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
} from "lucide-react"
import type { ComponentType } from "react"

export interface NavItemDef {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const GLOBAL_NAV_ITEMS: NavItemDef[] = [
  { to: "/projects", label: "Projetos", icon: FolderKanban },
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
  ]
}

export function useNavItems(): NavItemDef[] {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const match = pathname.match(/^\/projects\/([^/]+)/)
  if (match && match[1]) {
    return projectNavItems(match[1])
  }

  return GLOBAL_NAV_ITEMS
}

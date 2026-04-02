import { cn } from "@ui/lib/utils"
import type { ReactNode } from "react"

interface SidebarProps {
  collapsed: boolean
  children: ReactNode
}

export function Sidebar({ collapsed, children }: SidebarProps) {
  return (
    <aside
      className={cn(
        "hidden md:flex",
        "fixed inset-y-0 left-0 z-30",
        "flex-col overflow-hidden bg-sidebar",
        "transition-[width] duration-200 ease-in-out",
      )}
      style={{ width: collapsed ? 64 : 240 }}
    >
      {children}
    </aside>
  )
}

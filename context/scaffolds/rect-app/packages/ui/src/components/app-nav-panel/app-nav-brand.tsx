import type { ReactNode } from "react"
import { cn } from "@ui/lib/utils"

interface AppNavBrandProps {
  collapsed?: boolean
  logo: ReactNode
  logoCollapsed?: ReactNode
}

export function AppNavBrand({
  collapsed,
  logo,
  logoCollapsed,
}: AppNavBrandProps) {
  return (
    <div
      className={cn(
        "flex h-14 shrink-0 items-center",
        collapsed ? "justify-center px-2" : "px-6",
      )}
    >
      {collapsed && logoCollapsed ? logoCollapsed : logo}
    </div>
  )
}

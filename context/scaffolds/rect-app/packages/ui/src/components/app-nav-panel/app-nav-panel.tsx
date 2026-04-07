import type { ReactNode } from "react"
import { cn } from "@ui/lib/utils"
import { Separator } from "@ui/components/ui/separator"
import { AppMenu } from "@ui/components/app-menu/app-menu"
import { AppNavBrand } from "./app-nav-brand"
import { AppNavWidgets } from "./app-nav-widgets"
import { AvatarMenu } from "./avatar-menu"
import type { MenuContext, MenuWidget } from "@ui/components/app-menu/types"
import type { AvatarUser } from "./avatar-menu"

interface AppNavPanelProps {
  menuRoot: MenuContext
  activeRoute?: string
  collapsed?: boolean
  onNavigate?: (route: string) => void
  logo: ReactNode
  logoCollapsed?: ReactNode
  widgets?: MenuWidget[]
  user: AvatarUser
  theme?: "dark" | "light" | "system"
  onThemeChange?: (theme: "dark" | "light" | "system") => void
  onProfile?: () => void
  onLogout?: () => void
  onEditShortcuts?: () => void
}

export function AppNavPanel({
  menuRoot,
  activeRoute,
  collapsed,
  onNavigate,
  logo,
  logoCollapsed,
  widgets,
  user,
  theme,
  onThemeChange,
  onProfile,
  onLogout,
  onEditShortcuts,
}: AppNavPanelProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center">
        <div className="flex-1">
          <AppNavBrand
            collapsed={collapsed}
            logo={logo}
            logoCollapsed={logoCollapsed}
          />
        </div>
        {onEditShortcuts && !collapsed && (
          <button
            onClick={onEditShortcuts}
            className="shrink-0 px-4 text-xs font-medium text-primary"
          >
            Editar atalhos
          </button>
        )}
      </div>

      <Separator />

      <AppMenu
        root={menuRoot}
        activeRoute={activeRoute}
        collapsed={collapsed}
        onNavigate={onNavigate}
      />

      {widgets && widgets.length > 0 && (
        <>
          <Separator />
          <div className="shrink-0 py-2">
            <AppNavWidgets widgets={widgets} collapsed={collapsed} />
          </div>
        </>
      )}

      <Separator />

      <div className={cn("shrink-0", collapsed ? "px-2 py-2" : "px-3 py-2")}>
        <AvatarMenu
          user={user}
          collapsed={collapsed}
          theme={theme}
          onThemeChange={onThemeChange}
          onProfile={onProfile}
          onLogout={onLogout}
        />
      </div>
    </div>
  )
}

import { type ReactNode, useState } from "react"
import { Sidebar } from "./sidebar"
import { BreadcrumbBar } from "./breadcrumb-bar"
import type { BreadcrumbItem } from "./breadcrumb-bar"
import type { NotificationItem } from "@ui/components/notifications/notification-panel"
import { ShortcutBar } from "./shortcut-bar"
import { ShortcutEditor } from "./shortcut-editor"
import { AppNavPanel } from "@ui/components/app-nav-panel/app-nav-panel"
import { useIsMobile } from "@ui/hooks/use-media-query"
import { useSidebarState } from "@ui/hooks/use-sidebar-state"
import { Drawer, DrawerContent } from "@ui/components/ui/drawer"
import type {
  MenuContext,
  MenuItem,
  MenuWidget,
} from "@ui/components/app-menu/types"
import type { AvatarUser } from "@ui/components/app-nav-panel/avatar-menu"

interface AppShellProps {
  children: ReactNode
  menuRoot: MenuContext
  activeRoute?: string
  onNavigate?: (route: string) => void
  logo: ReactNode
  logoCollapsed?: ReactNode
  widgets?: MenuWidget[]
  user: AvatarUser
  theme?: "dark" | "light" | "system"
  onThemeChange?: (theme: "dark" | "light" | "system") => void
  onProfile?: () => void
  onLogout?: () => void
  breadcrumbs?: BreadcrumbItem[]
  pageTitle?: string
  shortcuts?: MenuItem[]
  shortcutsAvailable?: MenuItem[]
  shortcutsFull?: boolean
  onShortcutAdd?: (id: string) => void
  onShortcutRemove?: (id: string) => void
  onShortcutReorder?: (from: number, to: number) => void
  notifications?: NotificationItem[]
  onNotificationsViewAll?: () => void
  onNotificationClick?: (id: string) => void
  onSearch?: (query: string) => void
  canGoBack?: boolean
  onBack?: () => void
  menuOpen?: boolean
  onMenuOpenChange?: (open: boolean) => void
}

export function AppShell({
  children,
  menuRoot,
  activeRoute,
  onNavigate,
  logo,
  logoCollapsed,
  widgets,
  user,
  theme,
  onThemeChange,
  onProfile,
  onLogout,
  breadcrumbs = [],
  pageTitle,
  shortcuts = [],
  shortcutsAvailable = [],
  shortcutsFull = false,
  onShortcutAdd,
  onShortcutRemove,
  onShortcutReorder,
  notifications,
  onNotificationsViewAll,
  onNotificationClick,
  onSearch,
  canGoBack,
  onBack,
  menuOpen = false,
  onMenuOpenChange,
}: AppShellProps) {
  const isMobile = useIsMobile()
  const { collapsed, toggle } = useSidebarState()
  const [editorOpen, setEditorOpen] = useState(false)

  const setMenuDrawerOpen = (open: boolean) => {
    onMenuOpenChange?.(open)
  }

  const closeDrawerIfMobile = () => {
    if (isMobile) setMenuDrawerOpen(false)
  }

  const handleEditShortcuts = () => {
    setMenuDrawerOpen(false)
    // Small delay so menu drawer closes before editor opens
    setTimeout(() => setEditorOpen(true), 200)
  }

  const navPanel = (
    <AppNavPanel
      menuRoot={menuRoot}
      activeRoute={activeRoute}
      collapsed={!isMobile && collapsed}
      onNavigate={(route) => {
        onNavigate?.(route)
        closeDrawerIfMobile()
      }}
      logo={logo}
      logoCollapsed={logoCollapsed}
      widgets={widgets}
      user={user}
      theme={theme}
      onThemeChange={onThemeChange}
      onProfile={() => {
        onProfile?.()
        closeDrawerIfMobile()
      }}
      onLogout={() => {
        onLogout?.()
        closeDrawerIfMobile()
      }}
      onEditShortcuts={isMobile ? handleEditShortcuts : undefined}
    />
  )

  return (
    <div className="flex min-h-svh bg-background">
      {/* Desktop sidebar */}
      {!isMobile && <Sidebar collapsed={collapsed}>{navPanel}</Sidebar>}

      {/* Mobile menu drawer (Vaul bottom) */}
      {isMobile && (
        <Drawer open={menuOpen} onOpenChange={setMenuDrawerOpen}>
          <DrawerContent className="overflow-hidden">
            {navPanel}
          </DrawerContent>
        </Drawer>
      )}

      {/* Main content area */}
      <div
        className="flex min-w-0 flex-1 flex-col transition-[margin-left] duration-200 ease-in-out"
        style={{ marginLeft: isMobile ? 0 : collapsed ? 64 : 240 }}
      >
        <BreadcrumbBar
          breadcrumbs={breadcrumbs}
          pageTitle={pageTitle}
          sidebarCollapsed={collapsed}
          onToggleSidebar={toggle}
          onNavigate={onNavigate}
          onBack={onBack}
          notifications={notifications}
          onNotificationsViewAll={onNotificationsViewAll}
          onNotificationClick={onNotificationClick}
          onSearch={onSearch}
          canGoBack={canGoBack}
        />

        {/* Page content — shell p-0, pages use PageDefault/PageFull */}
        <main className={isMobile ? "flex-1 pb-14" : "flex-1"}>
          {children}
        </main>
      </div>

      {/* Mobile shortcut bar */}
      {isMobile && (
        <ShortcutBar
          shortcuts={shortcuts}
          activeRoute={activeRoute}
          onNavigate={onNavigate}
          onMenuOpen={() => setMenuDrawerOpen(true)}
          menuOpen={menuOpen}
        />
      )}

      {/* Shortcut editor drawer */}
      {isMobile && onShortcutAdd && (
        <ShortcutEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          shortcuts={shortcuts}
          available={shortcutsAvailable}
          isFull={shortcutsFull}
          onAdd={onShortcutAdd}
          onRemove={onShortcutRemove!}
          onReorder={onShortcutReorder!}
        />
      )}
    </div>
  )
}

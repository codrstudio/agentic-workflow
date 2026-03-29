import { useState, useCallback, type ReactNode } from "react"
import { useMatches, useRouter } from "@tanstack/react-router"
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@workspace/ui/components/drawer"
import { AppNavBrand } from "@workspace/ui/components/app-nav-panel/app-nav-brand"
import { AvatarMenu } from "@workspace/ui/components/app-nav-panel/avatar-menu"
import { AppMenu } from "@workspace/ui/components/app-menu/app-menu"
import { BreadcrumbBar } from "@workspace/ui/components/breadcrumb-bar"
import { ShortcutBar } from "@workspace/ui/components/shortcut-bar"
import type { ShortcutSlot } from "@workspace/ui/components/shortcut-bar"
import { ShortcutEditor, type ShortcutItem } from "@workspace/ui/components/shortcut-editor"
import type { Tier } from "@workspace/ui/components/app-menu/types"
import { useSession, signOut } from "@/lib/auth-client"
import { queryClient } from "@/lib/query-client"
import { useTheme } from "@/components/theme-provider"
import { usePresenceContext } from "@/components/presence-provider"
import { PresenceWidget } from "@/components/presence-widget"
import { chatMenu } from "@/config/menu"
import { House } from "@phosphor-icons/react"
import { BreadcrumbProvider, useBreadcrumbOverride } from "@/lib/breadcrumb-context"

const BRAND = {
  logoExpanded: "/chat/logo-h-light.svg",
  logoExpandedDark: "/chat/logo-h-dark.svg",
  logoCollapsed: "/chat/logo-light.svg",
  logoCollapsedDark: "/chat/logo-dark.svg",
  alt: "Coletivos",
}

const ALL_SHORTCUT_ITEMS: (ShortcutSlot & ShortcutItem)[] = [
  { id: "home", label: "Início", icon: House, route: "/" },
]

const DEFAULT_SHORTCUT_IDS = ["home"]

const SHORTCUTS_STORAGE_KEY = "shortcuts:chat"

function loadShortcuts(): ShortcutSlot[] {
  try {
    const raw = localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (!raw) return getSlotsByIds(DEFAULT_SHORTCUT_IDS)
    const { slots } = JSON.parse(raw) as { slots: string[] }
    const result = getSlotsByIds(slots)
    return result.length > 0 ? result : getSlotsByIds(DEFAULT_SHORTCUT_IDS)
  } catch {
    return getSlotsByIds(DEFAULT_SHORTCUT_IDS)
  }
}

function saveShortcuts(items: ShortcutItem[]) {
  localStorage.setItem(
    SHORTCUTS_STORAGE_KEY,
    JSON.stringify({ slots: items.map((i) => i.id), version: 1 })
  )
}

function getSlotsByIds(ids: string[]): ShortcutSlot[] {
  return ids
    .map((id) => ALL_SHORTCUT_ITEMS.find((item) => item.id === id))
    .filter((item): item is ShortcutSlot & ShortcutItem => !!item)
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <BreadcrumbProvider>
      <SidebarProvider>
        <AppShellInner>{children}</AppShellInner>
      </SidebarProvider>
    </BreadcrumbProvider>
  )
}

function AppShellInner({ children }: { children: ReactNode }) {
  const matches = useMatches()
  const router = useRouter()
  const { state: sidebarState } = useSidebar()
  const collapsed = sidebarState === "collapsed"
  const { theme, setTheme } = useTheme()
  const { data: session } = useSession()
  const presence = usePresenceContext()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [shortcuts, setShortcuts] = useState<ShortcutSlot[]>(loadShortcuts)

  const handleSaveShortcuts = useCallback((items: ShortcutItem[]) => {
    const slots = getSlotsByIds(items.map((i) => i.id))
    setShortcuts(slots)
    saveShortcuts(items)
  }, [])

  const currentPath = matches[matches.length - 1]?.fullPath ?? "/"
  const { override: breadcrumbOverride } = useBreadcrumbOverride()

  const user = session?.user
  const userName = (user as Record<string, unknown>)?.name as string ?? "Usuário"
  const userEmail = (user as Record<string, unknown>)?.email as string ?? ""
  const userRole = (user as Record<string, unknown>)?.role as string ?? "attendant"
  const userImage = (user as Record<string, unknown>)?.image as string | undefined

  const ROLE_LABELS: Record<string, string> = {
    admin: "Administrador",
    manager: "Gerente",
    attendant: "Atendente",
  }

  const avatarUser = {
    name: userName,
    email: userEmail,
    role: ROLE_LABELS[userRole] ?? userRole,
    image: userImage,
  }

  const userTier = (["admin", "manager", "attendant"].includes(userRole)
    ? userRole
    : "attendant") as Tier

  async function handleLogout() {
    await signOut()
    queryClient.clear()
    void router.navigate({ to: "/login" })
  }

  function handleNavigate(route: string) {
    void router.navigate({ to: route as "/" })
    setDrawerOpen(false)
  }

  // Build breadcrumbs from route matches
  const routeBreadcrumbs = matches
    .filter((m) => m.fullPath !== ("/_authenticated" as string) && m.fullPath !== "/")
    .map((m) => ({
      label: getBreadcrumbLabel(m.fullPath as string),
      href: m.fullPath as string,
    }))

  // Always start with "Início"
  routeBreadcrumbs.unshift({ label: "Início", href: "/" })

  // Use override breadcrumbs when provided (e.g. derivation chain), else fall back to route-based
  const breadcrumbs = breadcrumbOverride ?? routeBreadcrumbs

  const canGoBack = matches.length > 2

  // ---- Menu rendered for both sidebar and drawer ----
  const menuNode = (isCollapsed: boolean) => (
    <AppMenu
      context={chatMenu}
      userTier={userTier}
      currentRoute={currentPath}
      onNavigate={handleNavigate}
      collapsed={isCollapsed}
    />
  )

  return (
    <>
      {/* ---- DESKTOP SIDEBAR ---- */}
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <AppNavBrand {...BRAND} collapsed={collapsed} />
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>{menuNode(collapsed)}</SidebarContent>
        <SidebarSeparator />
        <div className="shrink-0 p-2">
          <PresenceWidget
            status={presence.status}
            queueSize={presence.queueSize}
            myChats={presence.myChats}
            onlineTeam={presence.onlineTeam}
            collapsed={collapsed}
            onStatusChange={(s) => {
              if (s === "online") presence.goOnline()
              else if (s === "paused") presence.goPaused()
              else presence.goOffline()
            }}
          />
        </div>
        <SidebarSeparator />
        <SidebarFooter>
          <AvatarMenu
            user={avatarUser}
            onLogout={handleLogout}
            theme={theme}
            onThemeChange={setTheme}
            collapsed={collapsed}
          />
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      {/* ---- MAIN CONTENT ---- */}
      <SidebarInset>
        <BreadcrumbBar
          leftSlot={
            <SidebarTrigger className="-ml-1 hidden md:flex" />
          }
          breadcrumbs={breadcrumbs}
          title={breadcrumbs[breadcrumbs.length - 1]?.label}
          onNavigate={handleNavigate}
          onBack={canGoBack ? () => router.history.back() : undefined}
          showBackButton={canGoBack}
        />

        <div className="flex flex-1 flex-col pb-[calc(env(safe-area-inset-bottom,0px)+2.75rem)] md:pb-0">
          {children}
        </div>
      </SidebarInset>

      {/* ---- MOBILE SHORTCUT BAR ---- */}
      <ShortcutBar
        slots={shortcuts}
        currentRoute={currentPath}
        onNavigate={handleNavigate}
        onMenuClick={() => setDrawerOpen(true)}
      />

      {/* ---- MOBILE DRAWER (bottom, Vaul) ---- */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Menu</DrawerTitle>
            <DrawerDescription>Menu de navegação</DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col overflow-hidden">
            <div className="shrink-0 p-2 flex items-center justify-between">
              <AppNavBrand {...BRAND} collapsed={false} />
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false)
                  setTimeout(() => setEditorOpen(true), 300)
                }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2"
              >
                Editar atalhos
              </button>
            </div>
            <Separator className="mx-2 w-auto" />
            <div className="flex-1 min-h-0 overflow-y-auto">
              {menuNode(false)}
            </div>
            <Separator className="mx-2 w-auto" />
            <div className="shrink-0 p-2">
              <PresenceWidget
                status={presence.status}
                queueSize={presence.queueSize}
                myChats={presence.myChats}
                onlineTeam={presence.onlineTeam}
                collapsed={false}
                onStatusChange={(s) => {
                  if (s === "online") presence.goOnline()
                  else if (s === "paused") presence.goPaused()
                  else presence.goOffline()
                }}
              />
            </div>
            <Separator className="mx-2 w-auto" />
            <div className="shrink-0 p-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
              <AvatarMenu
                user={avatarUser}
                onLogout={handleLogout}
                theme={theme}
                onThemeChange={setTheme}
              />
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* ---- SHORTCUT EDITOR (nested drawer) ---- */}
      <ShortcutEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        slots={shortcuts}
        availableItems={ALL_SHORTCUT_ITEMS}
        onSave={handleSaveShortcuts}
      />
    </>
  )
}

function getBreadcrumbLabel(path: string): string {
  const labels: Record<string, string> = {
    "/": "Início",
  }

  return labels[path] ?? path
}

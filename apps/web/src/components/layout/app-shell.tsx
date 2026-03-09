import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { FolderKanban, Terminal, Activity, ChevronLeft, ChevronRight, Sun, Moon, Monitor, LogOut } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/components/theme-provider"
import { BottomNav } from "@/components/layout/bottom-nav"

const NAV_ITEMS = [
  { to: "/projects", label: "Projetos", icon: FolderKanban },
  { to: "/console", label: "Console", icon: Terminal },
  { to: "/events", label: "Eventos", icon: Activity },
] as const

const COLLAPSED_KEY = "sidebar-collapsed"

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "true"
    } catch {
      return false
    }
  })

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }

  return (
    <div className="flex h-svh overflow-hidden">
      {/* Sidebar — hidden on mobile (< 768px) */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          "relative hidden flex-shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 md:flex",
          collapsed ? "w-14" : "w-56"
        )}
      >
        {/* Logo / header area */}
        <div className={cn(
          "flex h-14 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "justify-between"
        )}>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight">AW Monitor</span>
          )}
          <button
            onClick={toggle}
            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} icon={Icon} collapsed={collapsed} />
          ))}
        </nav>

        {/* User menu */}
        <UserMenu collapsed={collapsed} />
      </aside>

      {/* Content */}
      <main className="flex flex-1 flex-col overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* BottomNav — visible only on mobile (< 768px) */}
      <BottomNav />
    </div>
  )
}

function NavItem({
  to,
  label,
  icon: Icon,
  collapsed,
}: {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  collapsed: boolean
}) {
  const routerState = useRouterState()
  const isActive = routerState.location.pathname === to ||
    routerState.location.pathname.startsWith(to + "/")

  return (
    <Link
      to={to}
      title={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
        collapsed ? "justify-center" : "",
        isActive
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="size-4 flex-shrink-0" />
      {!collapsed && <span>{label}</span>}
    </Link>
  )
}

const THEME_CYCLE: Record<"light" | "dark" | "system", "dark" | "light" | "system"> = {
  light: "dark",
  dark: "system",
  system: "light",
}

const THEME_ICONS: Record<"light" | "dark" | "system", React.ComponentType<{ className?: string }>> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

const THEME_LABELS: Record<"light" | "dark" | "system", string> = {
  light: "Tema: claro",
  dark: "Tema: escuro",
  system: "Tema: sistema",
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  const username = user.isAuthenticated ? user.username : ""
  const initials = username.slice(0, 2).toUpperCase() || "?"
  const ThemeIcon = THEME_ICONS[theme]
  const nextTheme = THEME_CYCLE[theme]
  const themeLabel = THEME_LABELS[theme]

  return (
    <div className={cn(
      "flex flex-col gap-1 border-t border-border p-2",
    )}>
      {/* Avatar + username */}
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5",
          collapsed ? "justify-center" : "",
        )}
        title={collapsed ? username : undefined}
      >
        <div className="flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
          {initials}
        </div>
        {!collapsed && (
          <span className="truncate text-sm font-medium text-foreground">{username}</span>
        )}
      </div>

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(nextTheme)}
        title={themeLabel}
        aria-label={themeLabel}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          collapsed ? "justify-center" : "",
        )}
      >
        <ThemeIcon className="size-4 flex-shrink-0" />
        {!collapsed && <span>{themeLabel}</span>}
      </button>

      {/* Logout */}
      <button
        onClick={() => void logout()}
        title={collapsed ? "Sair" : undefined}
        aria-label="Sair"
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          collapsed ? "justify-center" : "",
        )}
      >
        <LogOut className="size-4 flex-shrink-0" />
        {!collapsed && <span>Sair</span>}
      </button>
    </div>
  )
}

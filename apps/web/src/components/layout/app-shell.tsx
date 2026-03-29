import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, Sun, Moon, Monitor, LogOut, Check } from "lucide-react"
import * as Popover from "@radix-ui/react-popover"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@workspace/ui/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/components/theme-provider"
import { BottomNav } from "@/components/layout/bottom-nav"
import { Breadcrumb } from "@/components/layout/breadcrumb"
import { useSSEContext, type SSEStatus } from "@/contexts/sse-context"
import { SSEProvider } from "@/contexts/sse-context"
import { useNavItems } from "@/components/layout/nav-items"

const COLLAPSED_KEY = "sidebar-collapsed"

export function AppShell({ children }: { children: React.ReactNode }) {
  const navItems = useNavItems()
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
    <SSEProvider>
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
            <span className="text-sm font-semibold tracking-tight">Agentic Workflow</span>
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
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavItem key={to} to={to} label={label} icon={Icon} collapsed={collapsed} />
          ))}
        </nav>

        {/* User menu */}
        <UserMenu collapsed={collapsed} />
      </aside>

      {/* Content */}
      <main className="flex flex-1 flex-col overflow-auto pb-16 md:pb-0">
        <Breadcrumb />
        <PageTransition>{children}</PageTransition>
      </main>

      {/* BottomNav — visible only on mobile (< 768px) */}
      <BottomNav />
    </div>
    </SSEProvider>
  )
}

function PageTransition({ children }: { children: React.ReactNode }) {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15, ease: "easeInOut" }}
        className="flex flex-1 flex-col min-h-0"
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
  const pathname = routerState.location.pathname
  // Exact match for top-level list pages (/projects) and project dashboard (/projects/:slug)
  const isExactOnly = to === "/projects" || /^\/projects\/[^/]+$/.test(to)
  const isActive = isExactOnly
    ? pathname === to
    : pathname === to || pathname.startsWith(to + "/")

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

const THEME_OPTIONS: { value: "light" | "dark" | "system"; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
]

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()

  const username = user.isAuthenticated ? user.username : ""
  const role = user.isAuthenticated ? user.role : ""
  const initials = username.slice(0, 2).toUpperCase() || "?"

  return (
    <div className="border-t border-border p-2">
      <Popover.Root>
        <Popover.Trigger asChild>
          <button
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted",
              collapsed ? "justify-center" : "",
            )}
            title={collapsed ? username : undefined}
          >
            <div className="relative flex size-6 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {initials}
              <SSEDot />
            </div>
            {!collapsed && (
              <span className="truncate text-sm font-medium text-foreground">{username}</span>
            )}
          </button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={8}
            className="z-50 w-56 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {/* User info */}
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="relative flex size-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {initials}
                <SSEDot />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">{username}</span>
                {role && <span className="truncate text-xs text-muted-foreground">{role}</span>}
              </div>
            </div>

            <div className="mx-1 my-1 h-px bg-border" />

            {/* Theme options */}
            <div className="flex flex-col gap-0.5">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <Icon className="size-4 flex-shrink-0" />
                  <span>{label}</span>
                  {theme === value && <Check className="ml-auto size-3.5" />}
                </button>
              ))}
            </div>

            <div className="mx-1 my-1 h-px bg-border" />

            {/* Logout */}
            <button
              onClick={() => void logout()}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <LogOut className="size-4 flex-shrink-0" />
              <span>Sair</span>
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}

const SSE_DOT_CLASS: Record<SSEStatus, string> = {
  connected: "bg-green-500",
  reconnecting: "bg-yellow-500 animate-pulse",
  disconnected: "bg-red-500",
}

const SSE_DOT_LABEL: Record<SSEStatus, string> = {
  connected: "SSE conectado",
  reconnecting: "SSE reconectando…",
  disconnected: "SSE desconectado",
}

function SSEDot() {
  const { status } = useSSEContext()

  return (
    <span
      className={cn("absolute -right-0.5 -top-0.5 size-2 rounded-full ring-1 ring-background", SSE_DOT_CLASS[status])}
      title={SSE_DOT_LABEL[status]}
    />
  )
}

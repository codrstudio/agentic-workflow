import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { FolderKanban, Terminal, Activity, Menu, X, Check } from "lucide-react"
import { Drawer } from "vaul"
import { cn } from "@workspace/ui/lib/utils"

export type NavItemDef = {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export const ALL_NAV_ITEMS: NavItemDef[] = [
  { to: "/projects", label: "Projetos", icon: FolderKanban },
  { to: "/console", label: "Console", icon: Terminal },
  { to: "/events", label: "Eventos", icon: Activity },
]

const SHORTCUTS_KEY = "bottom-nav-shortcuts"
const DEFAULT_SHORTCUTS = ALL_NAV_ITEMS.slice(0, 4).map((i) => i.to)

function loadShortcuts(): string[] {
  try {
    const raw = localStorage.getItem(SHORTCUTS_KEY)
    if (!raw) return DEFAULT_SHORTCUTS
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return (parsed as string[]).slice(0, 4)
    }
  } catch {
    // ignore
  }
  return DEFAULT_SHORTCUTS
}

function saveShortcuts(shortcuts: string[]) {
  try {
    localStorage.setItem(SHORTCUTS_KEY, JSON.stringify(shortcuts))
  } catch {
    // ignore
  }
}

export function BottomNav() {
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [customizing, setCustomizing] = React.useState(false)
  const [shortcuts, setShortcuts] = React.useState<string[]>(loadShortcuts)
  const [pendingShortcuts, setPendingShortcuts] = React.useState<string[]>([])

  const shortcutItems = shortcuts
    .map((to) => ALL_NAV_ITEMS.find((i) => i.to === to))
    .filter(Boolean) as NavItemDef[]

  const openCustomize = () => {
    setPendingShortcuts([...shortcuts])
    setCustomizing(true)
  }

  const saveCustomize = () => {
    setShortcuts(pendingShortcuts)
    saveShortcuts(pendingShortcuts)
    setCustomizing(false)
    setMenuOpen(false)
  }

  const togglePending = (to: string) => {
    setPendingShortcuts((prev) => {
      if (prev.includes(to)) return prev.filter((x) => x !== to)
      if (prev.length >= 4) return prev
      return [...prev, to]
    })
  }

  return (
    <>
      {/* Bottom navigation bar — visible only on mobile (< 768px) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background md:hidden"
        aria-label="Navegação mobile"
      >
        {shortcutItems.map(({ to, label, icon: Icon }) => (
          <BottomNavLink key={to} to={to} label={label} icon={Icon} />
        ))}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Abrir menu"
          className="flex flex-col items-center gap-1 px-3 py-1 text-muted-foreground"
        >
          <Menu className="size-5" />
          <span className="text-[10px]">Menu</span>
        </button>
      </nav>

      {/* Drawer menu */}
      <Drawer.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
          <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl bg-background">
            <Drawer.Handle className="mx-auto my-3 h-1.5 w-12 rounded-full bg-muted" />

            {customizing ? (
              /* Customize page */
              <div className="flex flex-1 flex-col overflow-auto pb-safe">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <button
                    onClick={() => setCustomizing(false)}
                    className="text-sm text-muted-foreground"
                  >
                    Cancelar
                  </button>
                  <Drawer.Title className="text-sm font-semibold">Customizar atalhos</Drawer.Title>
                  <button
                    onClick={saveCustomize}
                    className="text-sm font-medium text-primary"
                  >
                    Salvar
                  </button>
                </div>
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  Selecione até 4 atalhos que aparecem na barra inferior.
                </p>
                <ul className="flex flex-col gap-0.5 px-2 pb-4">
                  {ALL_NAV_ITEMS.map(({ to, label, icon: Icon }) => {
                    const selected = pendingShortcuts.includes(to)
                    const disabled = !selected && pendingShortcuts.length >= 4
                    return (
                      <li key={to}>
                        <button
                          onClick={() => togglePending(to)}
                          disabled={disabled}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                            selected
                              ? "bg-accent text-accent-foreground"
                              : disabled
                              ? "opacity-40"
                              : "hover:bg-muted"
                          )}
                        >
                          <Icon className="size-5 flex-shrink-0" />
                          <span className="flex-1 text-left">{label}</span>
                          {selected && <Check className="size-4 text-primary" />}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              /* Main menu */
              <div className="flex flex-1 flex-col overflow-auto pb-safe">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <Drawer.Title className="text-sm font-semibold">Menu</Drawer.Title>
                  <button
                    onClick={() => setMenuOpen(false)}
                    aria-label="Fechar menu"
                    className="text-muted-foreground"
                  >
                    <X className="size-5" />
                  </button>
                </div>
                <ul className="flex flex-col gap-0.5 px-2 py-2">
                  {ALL_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                    <li key={to}>
                      <DrawerNavLink
                        to={to}
                        label={label}
                        icon={Icon}
                        onNavigate={() => setMenuOpen(false)}
                      />
                    </li>
                  ))}
                  <li>
                    <button
                      onClick={openCustomize}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm hover:bg-muted"
                    >
                      <Menu className="size-5 flex-shrink-0 text-muted-foreground" />
                      <span>Customizar</span>
                    </button>
                  </li>
                </ul>
              </div>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}

function BottomNavLink({ to, label, icon: Icon }: NavItemDef) {
  const routerState = useRouterState()
  const isActive =
    routerState.location.pathname === to ||
    routerState.location.pathname.startsWith(to + "/")

  return (
    <Link
      to={to}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-1 transition-colors",
        isActive ? "text-foreground" : "text-muted-foreground"
      )}
    >
      <Icon className="size-5" />
      <span className="text-[10px]">{label}</span>
    </Link>
  )
}

function DrawerNavLink({
  to,
  label,
  icon: Icon,
  onNavigate,
}: NavItemDef & { onNavigate: () => void }) {
  const routerState = useRouterState()
  const isActive =
    routerState.location.pathname === to ||
    routerState.location.pathname.startsWith(to + "/")

  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
        isActive ? "bg-accent text-accent-foreground" : "hover:bg-muted"
      )}
    >
      <Icon className="size-5 flex-shrink-0" />
      <span>{label}</span>
    </Link>
  )
}

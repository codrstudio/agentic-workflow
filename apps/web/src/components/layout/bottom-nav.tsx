import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { Menu, X } from "lucide-react"
import { Drawer } from "vaul"
import { cn } from "@workspace/ui/lib/utils"
import { useNavItems, type NavItemDef } from "@/components/layout/nav-items"

export function BottomNav() {
  const navItems = useNavItems()
  const [menuOpen, setMenuOpen] = React.useState(false)

  // Show up to 4 items directly in the bar
  const barItems = navItems.slice(0, 4)

  return (
    <>
      {/* Bottom navigation bar — visible only on mobile (< 768px) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-background md:hidden"
        aria-label="Navegação mobile"
      >
        {barItems.map(({ to, label, icon: Icon }) => (
          <BottomNavLink key={to} to={to} label={label} icon={Icon} />
        ))}
        {navItems.length > 4 && (
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            className="flex flex-col items-center gap-1 px-3 py-1 text-muted-foreground"
          >
            <Menu className="size-5" />
            <span className="text-[10px]">Menu</span>
          </button>
        )}
      </nav>

      {/* Drawer menu — only when there are more than 4 items */}
      {navItems.length > 4 && (
        <Drawer.Root open={menuOpen} onOpenChange={setMenuOpen}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
            <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl bg-background">
              <Drawer.Handle className="mx-auto my-3 h-1.5 w-12 rounded-full bg-muted" />

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
                  {navItems.map(({ to, label, icon: Icon }) => (
                    <li key={to}>
                      <DrawerNavLink
                        to={to}
                        label={label}
                        icon={Icon}
                        onNavigate={() => setMenuOpen(false)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      )}
    </>
  )
}

function isRouteActive(pathname: string, to: string): boolean {
  const isProjectDashboard = /^\/projects\/[^/]+$/.test(to)
  return isProjectDashboard ? pathname === to : pathname === to || pathname.startsWith(to + "/")
}

function BottomNavLink({ to, label, icon: Icon }: NavItemDef) {
  const routerState = useRouterState()
  const isActive = isRouteActive(routerState.location.pathname, to)

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
  const isActive = isRouteActive(routerState.location.pathname, to)

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

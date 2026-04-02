import {
  createFileRoute,
  Outlet,
  Link,
  useLocation,
} from "@tanstack/react-router"
import { cn } from "@ui/lib/utils"
import { PageDefault } from "@ui/components/page-layout"
import { useIsMobile } from "@ui/hooks/use-media-query"
import { Sun, CaretRight } from "@phosphor-icons/react"
import type { ComponentType } from "react"

export const Route = createFileRoute("/_shell/settings")({
  component: SettingsLayout,
  staticData: { breadcrumb: "Configurações" },
})

interface SettingsMenuItem {
  to: "/settings/theme"
  label: string
  description: string
  icon: ComponentType<{ className?: string; weight?: string }>
}

const menuItems: SettingsMenuItem[] = [
  {
    to: "/settings/theme",
    label: "Tema",
    description: "Claro, escuro ou automático",
    icon: Sun,
  },
]

function SettingsMenu() {
  return (
    <nav className="flex flex-col gap-1">
      {menuItems.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
            "hover:bg-accent",
          )}
          activeProps={{
            className: "bg-accent text-accent-foreground",
          }}
        >
          <item.icon className="size-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground">
              {item.description}
            </div>
          </div>
          <CaretRight className="size-4 shrink-0 text-muted-foreground md:hidden" />
        </Link>
      ))}
    </nav>
  )
}

function SettingsLayout() {
  const isMobile = useIsMobile()
  const { pathname } = useLocation()
  const isIndex = pathname === "/settings" || pathname === "/settings/"

  if (isMobile) {
    if (isIndex) {
      return (
        <PageDefault>
          <h1 className="text-2xl font-semibold tracking-tight">
            Configurações
          </h1>
          <SettingsMenu />
        </PageDefault>
      )
    }

    return (
      <PageDefault>
        <Outlet />
      </PageDefault>
    )
  }

  return (
    <PageDefault className="mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      <div className="flex gap-6">
        <aside className="w-60 shrink-0">
          <SettingsMenu />
        </aside>
        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </PageDefault>
  )
}

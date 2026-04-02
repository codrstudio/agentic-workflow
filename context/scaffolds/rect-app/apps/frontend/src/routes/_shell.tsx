import {
  createFileRoute,
  Outlet,
  useRouter,
  useMatches,
} from "@tanstack/react-router"
import { useMemo } from "react"
import { z } from "zod"
import { ErrorState } from "@/components/error-state"
import { NotFoundState } from "@/components/not-found-state"
import { AppShell } from "@ui/components/app-shell/app-shell"
import { menuRoot } from "@/config/menu"
import { useShortcuts } from "@ui/hooks/use-shortcuts"
import { useTheme } from "@ui/components/theme-provider"
import { mockUser } from "@/config/mock-user"
import type { BreadcrumbItem } from "@ui/components/app-shell/breadcrumb-bar"
import type { NotificationItem } from "@ui/components/notifications/notification-panel"

const shellSearchSchema = z.object({
  menu: z.boolean().optional(),
})

export const Route = createFileRoute("/_shell")({
  validateSearch: shellSearchSchema,
  component: ShellLayout,
  notFoundComponent: NotFoundState,
  errorComponent: ErrorState,
})

const user = mockUser

const mockNotifications: NotificationItem[] = [
  {
    id: "1",
    title: "Nova mensagem recebida",
    description:
      "Voce recebeu uma nova mensagem de Maria Silva sobre o projeto de redesign.",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "2",
    title: "Tarefa atribuida a voce",
    description:
      "Carlos Oliveira atribuiu a tarefa 'Revisar componentes de UI' para voce.",
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    read: false,
  },
  {
    id: "3",
    title: "Deploy concluido",
    description:
      "O deploy da versao 2.1.0 foi concluido com sucesso no ambiente de staging.",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    read: true,
  },
]

function ShellLayout() {
  const router = useRouter()
  const matches = useMatches()
  const { theme, setTheme } = useTheme()
  const { menu: menuOpen = false } = Route.useSearch()
  const {
    shortcuts,
    available,
    isFull,
    add,
    remove,
    reorder,
  } = useShortcuts(menuRoot)

  const handleMenuOpenChange = (open: boolean) => {
    router.navigate({
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        menu: open || undefined,
      }),
      replace: true,
    })
  }

  const activeRoute = router.state.location.pathname

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const items: BreadcrumbItem[] = [{ label: "Home", route: "/" }]

    for (const match of matches) {
      const label = (match.staticData as { breadcrumb?: string })?.breadcrumb
      if (label) {
        items.push({ label, route: match.pathname })
      }
    }

    return items
  }, [matches])

  const pageTitle =
    breadcrumbs.length > 0
      ? breadcrumbs[breadcrumbs.length - 1].label
      : "Home"

  return (
    <AppShell
      menuRoot={menuRoot}
      activeRoute={activeRoute}
      onNavigate={(route) => router.navigate({ to: route })}
      logo={
        <>
          <img src="/app/brand/logo-h-light.svg" alt="Scaffold" className="h-6 dark:hidden" />
          <img src="/app/brand/logo-h-dark.svg" alt="Scaffold" className="hidden h-6 dark:block" />
        </>
      }
      logoCollapsed={
        <>
          <img src="/app/brand/logo-light.svg" alt="Scaffold" className="h-6 dark:hidden" />
          <img src="/app/brand/logo-dark.svg" alt="Scaffold" className="hidden h-6 dark:block" />
        </>
      }
      user={user}
      theme={theme}
      onThemeChange={setTheme}
      onProfile={() => router.navigate({ to: "/profile" })}
      shortcuts={shortcuts}
      shortcutsAvailable={available}
      shortcutsFull={isFull}
      onShortcutAdd={add}
      onShortcutRemove={remove}
      onShortcutReorder={reorder}
      notifications={mockNotifications}
      onNotificationsViewAll={() => router.navigate({ to: "/notifications" })}
      breadcrumbs={breadcrumbs}
      pageTitle={pageTitle}
      canGoBack={breadcrumbs.length > 1}
      onBack={() => {
        const parent = breadcrumbs[breadcrumbs.length - 2]
        if (parent?.route) router.navigate({ to: parent.route })
      }}
      menuOpen={menuOpen}
      onMenuOpenChange={handleMenuOpenChange}
    >
      <Outlet />
    </AppShell>
  )
}

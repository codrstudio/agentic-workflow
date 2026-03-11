import * as React from "react"
import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight, MoreHorizontal } from "lucide-react"
import { Drawer } from "vaul"
import { cn } from "@workspace/ui/lib/utils"

export type BreadcrumbItem = {
  label: string
  href?: string
}

const SUB_ROUTE_LABELS: Record<string, string> = {
  info: "Projeto",
  waves: "Waves",
  console: "Console",
  sprints: "Sprints",
}

function useBreadcrumbs(): BreadcrumbItem[] {
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  if (pathname === "/projects" || pathname === "/") return []

  const crumbs: BreadcrumbItem[] = []
  const segments = pathname.split("/").filter(Boolean)

  if (segments[0] !== "projects") return []

  crumbs.push({ label: "Projetos", href: "/projects" })

  if (!segments[1]) return crumbs

  const slug = segments[1]

  // /projects/:slug — Dashboard (last level)
  if (segments.length === 2) {
    crumbs.push({ label: slug })
    return crumbs
  }

  // Has sub-route — slug is always a link
  crumbs.push({ label: slug, href: `/projects/${slug}` })

  const subRoute = segments[2]

  // /projects/:slug/info, /projects/:slug/console (picker), /projects/:slug/sprints (picker)
  if (subRoute && subRoute !== "waves" && segments.length === 3) {
    crumbs.push({ label: SUB_ROUTE_LABELS[subRoute] ?? subRoute })
    return crumbs
  }

  // /projects/:slug/waves
  if (subRoute === "waves") {
    if (segments.length === 3) {
      crumbs.push({ label: "Waves" })
      return crumbs
    }

    // Has wave number
    const waveNumber = segments[3]!
    if (segments.length === 4) {
      crumbs.push({ label: "Waves", href: `/projects/${slug}/waves` })
      crumbs.push({ label: `Wave ${waveNumber}` })
      return crumbs
    }

    // Wave sub-routes
    crumbs.push({ label: "Waves", href: `/projects/${slug}/waves` })
    crumbs.push({
      label: `Wave ${waveNumber}`,
      href: `/projects/${slug}/waves/${waveNumber}`,
    })

    const waveSubRoute = segments[4]

    // /projects/:slug/waves/:n/steps/:idx
    if (waveSubRoute === "steps" && segments[5] !== undefined) {
      crumbs.push({ label: `Step ${segments[5]}` })
      return crumbs
    }

    // /projects/:slug/waves/:n/console
    if (waveSubRoute === "console") {
      crumbs.push({ label: "Console" })
      return crumbs
    }

    // /projects/:slug/waves/:n/sprints
    if (waveSubRoute === "sprints") {
      crumbs.push({ label: "Sprints" })
      return crumbs
    }
  }

  return crumbs
}

export function Breadcrumb() {
  const crumbs = useBreadcrumbs()

  if (crumbs.length === 0) return null

  return (
    <>
      {/* Desktop: full horizontal breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="hidden items-center gap-1 px-4 py-2 text-sm md:flex"
      >
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1
          return (
            <React.Fragment key={idx}>
              {idx > 0 && (
                <ChevronRight className="size-3.5 flex-shrink-0 text-muted-foreground" />
              )}
              {!isLast && crumb.href ? (
                <Link
                  to={crumb.href}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          )
        })}
      </nav>

      {/* Mobile: last level + "..." drawer */}
      <MobileBreadcrumb crumbs={crumbs} />
    </>
  )
}

function MobileBreadcrumb({ crumbs }: { crumbs: BreadcrumbItem[] }) {
  const [open, setOpen] = React.useState(false)

  if (crumbs.length === 0) return null

  const last = crumbs[crumbs.length - 1]!
  const previous = crumbs.slice(0, -1)

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 px-4 py-2 text-sm md:hidden"
    >
      {previous.length > 0 && (
        <>
          <Drawer.Root open={open} onOpenChange={setOpen}>
            <Drawer.Trigger asChild>
              <button
                aria-label="Ver níveis anteriores do breadcrumb"
                className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </Drawer.Trigger>
            <Drawer.Portal>
              <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40" />
              <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[50vh] flex-col rounded-t-2xl bg-background pb-safe">
                <Drawer.Handle className="mx-auto my-3 h-1.5 w-12 rounded-full bg-muted" />
                <Drawer.Title className="sr-only">Navegação</Drawer.Title>
                <ul className="flex flex-col gap-0.5 overflow-auto px-2 pb-4">
                  {previous.map((crumb, idx) => (
                    <li key={idx}>
                      {crumb.href ? (
                        <Link
                          to={crumb.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-muted"
                        >
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                          {crumb.label}
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2 rounded-lg px-3 py-3 text-sm text-muted-foreground">
                          <ChevronRight className="size-3.5" />
                          {crumb.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </Drawer.Content>
            </Drawer.Portal>
          </Drawer.Root>
          <ChevronRight className="size-3.5 flex-shrink-0 text-muted-foreground" />
        </>
      )}
      <span className="font-medium text-foreground">{last.label}</span>
    </nav>
  )
}

import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from "@tanstack/react-router"
import type { AuthContextValue } from "@/contexts/auth-context"
import { LoginPage } from "@/pages/login"
import { ProjectsPage } from "@/pages/projects"
import { ProjectDetailPage } from "@/pages/project-detail"
import { AppShell } from "@/components/layout/app-shell"

// Root route with context type
const rootRoute = createRootRouteWithContext<{ auth: AuthContextValue }>()({
  component: () => <Outlet />,
})

// Public route: /login — redirects to /projects if already authenticated
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: ({ context }) => {
    if (context.auth.user.isAuthenticated) {
      throw redirect({ to: "/projects" })
    }
  },
  component: LoginPage,
})

// Auth layout route: requires authentication
const authRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "_auth",
  beforeLoad: ({ context }) => {
    if (!context.auth.user.isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: () => <AppShell><Outlet /></AppShell>,
})

// / → redirect to /projects
const indexRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/projects" })
  },
})

const projectsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects",
  component: ProjectsPage,
})

const projectDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug",
  component: ProjectDetailPage,
})

const waveDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/waves/$waveNumber",
  component: () => <div>Wave Detail (stub)</div>,
})

const stepDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/waves/$waveNumber/steps/$stepIndex",
  component: () => <div>Step Detail (stub)</div>,
})

const consoleRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/console",
  component: () => <div>Console (stub)</div>,
})

const eventsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/events",
  component: () => <div>Events (stub)</div>,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    indexRoute,
    projectsRoute,
    projectDetailRoute,
    waveDetailRoute,
    stepDetailRoute,
    consoleRoute,
    eventsRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  context: { auth: undefined! },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

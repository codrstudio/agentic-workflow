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
import { ProjectInfoPage } from "@/pages/project-info"
import { ProjectWavesPage } from "@/pages/project-waves"
import { ProjectConsolePickerPage } from "@/pages/project-console-picker"
import { ProjectSprintsPickerPage } from "@/pages/project-sprints-picker"
import { WaveDetailPage } from "@/pages/wave-detail"
import { WaveConsolePage } from "@/pages/wave-console"
import { WaveSprintsPage } from "@/pages/wave-sprints"
import { StepDetailPage } from "@/pages/step-detail"
import { ProjectMonitorPage } from "@/pages/project-monitor"
import { AppShell } from "@/components/layout/app-shell"
import { ProjectNewPage } from "@/pages/project-new"
import { ProjectTaskEditPage } from "@/pages/project-task-edit"
import { ProjectRunNewPage } from "@/pages/project-run-new"
import { ProjectArtifactsPage } from "@/pages/project-artifacts"

// Root route with context type
const rootRoute = createRootRouteWithContext<{ auth: AuthContextValue }>()({
  component: () => <Outlet />,
})

// Public route: /login — redirects to /projects if already authenticated
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  beforeLoad: ({ context }) => {
    if (context.auth?.user.isAuthenticated) {
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
    if (!context.auth?.user.isAuthenticated) {
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

const projectNewRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/new",
  component: ProjectNewPage,
})

const projectTaskEditRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/task/edit",
  component: ProjectTaskEditPage,
})

const projectDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug",
  component: ProjectDetailPage,
})

const projectInfoRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/info",
  component: ProjectInfoPage,
})

const projectWavesRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/waves",
  component: ProjectWavesPage,
})

const projectConsoleRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/console",
  component: ProjectConsolePickerPage,
})

const projectSprintsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/sprints",
  component: ProjectSprintsPickerPage,
})

const waveDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/waves/$waveNumber",
  component: WaveDetailPage,
})

const waveConsoleRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/waves/$waveNumber/console",
  component: WaveConsolePage,
})

const waveSprintsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/waves/$waveNumber/sprints",
  component: WaveSprintsPage,
})

const stepDetailRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/waves/$waveNumber/steps/$stepIndex",
  component: StepDetailPage,
})

const projectMonitorRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/monitor",
  component: ProjectMonitorPage,
})

const projectRunNewRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/runs/new",
  component: ProjectRunNewPage,
})

const projectArtifactsRoute = createRoute({
  getParentRoute: () => authRoute,
  path: "/projects/$slug/artifacts",
  component: ProjectArtifactsPage,
})

const routeTree = rootRoute.addChildren([
  loginRoute,
  authRoute.addChildren([
    indexRoute,
    projectsRoute,
    projectNewRoute,
    projectTaskEditRoute,
    projectDetailRoute,
    projectInfoRoute,
    projectWavesRoute,
    projectConsoleRoute,
    projectSprintsRoute,
    waveDetailRoute,
    waveConsoleRoute,
    waveSprintsRoute,
    stepDetailRoute,
    projectMonitorRoute,
    projectRunNewRoute,
    projectArtifactsRoute,
  ]),
])

export const router = createRouter({
  routeTree,
  basepath: "/web",
  context: { auth: undefined! },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

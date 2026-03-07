import {
  createRouter,
  createRootRouteWithContext,
  createRoute,
  redirect,
  Outlet,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { useAuthStore } from "@/stores/auth.store";
import { LoginPage } from "@/pages/login";
import { ProjectsPage } from "@/pages/projects";
import { ProjectSourcesPage } from "@/pages/project-sources";
import { ProjectChatPage } from "@/pages/project-chat";
import { ProjectArtifactsPage } from "@/pages/project-artifacts";
import { ChatSessionPage } from "@/pages/chat-session";
import { ProjectPipelinePage } from "@/pages/project-pipeline";
import { HarnessOverviewPage } from "@/pages/harness-overview";
import { ProjectReviewsPage } from "@/pages/project-reviews";
import { ProjectNav } from "@/components/layout/project-nav";

interface RouterContext {
  breadcrumb?: string;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});

// _public layout
const publicLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "_public",
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => publicLayout,
  path: "/login",
  component: LoginPage,
});

// _authenticated layout
const authenticatedLayout = createRoute({
  getParentRoute: () => rootRoute,
  id: "_authenticated",
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: Outlet,
});

// / -> redirect to /projects
const indexRoute = createRoute({
  getParentRoute: () => authenticatedLayout,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
});

// /projects
const projectsRoute = createRoute({
  getParentRoute: () => authenticatedLayout,
  path: "/projects",
  component: ProjectsPage,
  staticData: { breadcrumb: "Projects" },
});

// /projects/$projectId
const projectRoute = createRoute({
  getParentRoute: () => projectsRoute,
  path: "$projectId",
  component: () => (
    <>
      <ProjectNav />
      <Outlet />
    </>
  ),
  staticData: { breadcrumb: "$projectId" },
});

// /projects/$projectId/ -> redirect to sources
const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/",
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectId/sources",
      params: { projectId: params.projectId },
    });
  },
});

// /projects/$projectId/sources
const projectSourcesRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/sources",
  component: ProjectSourcesPage,
  staticData: { breadcrumb: "Sources" },
});

// /projects/$projectId/chat
const projectChatRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/chat",
  component: ProjectChatPage,
  staticData: { breadcrumb: "Chat" },
});

// /projects/$projectId/chat/$sessionId
const chatSessionRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/chat/$sessionId",
  component: ChatSessionPage,
  staticData: { breadcrumb: "Conversa" },
});

// /projects/$projectId/artifacts
const projectArtifactsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/artifacts",
  component: ProjectArtifactsPage,
  staticData: { breadcrumb: "Artifacts" },
});

// /projects/$projectId/pipeline
const projectPipelineRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/pipeline",
  component: ProjectPipelinePage,
  staticData: { breadcrumb: "Pipeline" },
});

// /projects/$projectId/reviews
const projectReviewsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/reviews",
  component: ProjectReviewsPage,
  staticData: { breadcrumb: "Reviews" },
});

// /harness
const harnessRoute = createRoute({
  getParentRoute: () => authenticatedLayout,
  path: "/harness",
  component: HarnessOverviewPage,
  staticData: { breadcrumb: "Harness" },
});

// /harness/$projectId — placeholder for workspace detail (F-042)
const harnessDetailRoute = createRoute({
  getParentRoute: () => harnessRoute,
  path: "$projectId",
  component: () => <div className="p-6">Workspace detail (coming soon)</div>,
  staticData: { breadcrumb: "$projectId" },
});

const routeTree = rootRoute.addChildren([
  publicLayout.addChildren([loginRoute]),
  authenticatedLayout.addChildren([
    indexRoute,
    projectsRoute.addChildren([
      projectRoute.addChildren([
        projectIndexRoute,
        projectSourcesRoute,
        projectChatRoute,
        chatSessionRoute,
        projectArtifactsRoute,
        projectPipelineRoute,
        projectReviewsRoute,
      ]),
    ]),
    harnessRoute.addChildren([harnessDetailRoute]),
  ]),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
  interface StaticDataRouteOption {
    breadcrumb?: string;
  }
}

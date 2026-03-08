import {
  createRouter,
  createRootRouteWithContext,
  createRoute,
  redirect,
  Outlet,
  useParams,
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
import { WorkspaceDetailPage } from "@/pages/workspace-detail";
import { ProjectReviewsPage } from "@/pages/project-reviews";
import { ProjectMetricsPage } from "@/pages/project-metrics";
import { ReviewPanelPage } from "@/pages/review-panel";
import { ProjectSettingsPage } from "@/pages/project-settings";
import { McpServerDetailPage } from "@/pages/mcp-server-detail";
import { ACRListPage } from "@/pages/acr-list";
import { ACRDetailPage } from "@/pages/acr-detail";
import { CostDashboardPage } from "@/pages/cost-dashboard";
import { HandoffListPage } from "@/pages/handoff-list";
import { HandoffWizardPage } from "@/pages/handoff-wizard";
import { AgenticBoardPage } from "@/pages/agentic-board";
import { BoardConfigPage } from "@/pages/board-config";
import { PipelineModelConfigPage } from "@/pages/pipeline-model-config";
import { GraphConfigPage } from "@/pages/graph-config";
import { QualityGatesSettingsPage } from "@/pages/quality-gates-settings";
import { ProjectNav } from "@/components/layout/project-nav";
import { ResumeBanner } from "@/components/resume-banner";
import { BreakReminder } from "@/components/break-reminder";

function ProjectLayout() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  return (
    <>
      <ProjectNav />
      <ResumeBanner projectSlug={projectId} />
      <Outlet />
      <BreakReminder projectSlug={projectId} />
    </>
  );
}

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
  component: ProjectLayout,
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

// /projects/$projectId/artifacts/acrs
const projectACRsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/artifacts/acrs",
  component: ACRListPage,
  staticData: { breadcrumb: "ACRs" },
});

// /projects/$projectId/artifacts/acrs/$acrId
const acrDetailRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/artifacts/acrs/$acrId",
  component: ACRDetailPage,
  staticData: { breadcrumb: "ACR Detail" },
});

// /projects/$projectId/handoff (F-156)
const projectHandoffRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/handoff",
  component: HandoffListPage,
  staticData: { breadcrumb: "Handoff" },
});

// /projects/$projectId/handoff/new (F-157)
const projectHandoffNewRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/handoff/new",
  component: HandoffWizardPage,
  staticData: { breadcrumb: "Novo Handoff" },
  validateSearch: (search: Record<string, unknown>) => ({
    step: (search.step as string) || "1",
    requestId: (search.requestId as string) || undefined,
  }),
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

// /projects/$projectId/reviews/$reviewId (F-049)
const reviewPanelRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/reviews/$reviewId",
  component: ReviewPanelPage,
  staticData: { breadcrumb: "Review" },
});

// /projects/$projectId/metrics
const projectMetricsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/metrics",
  component: ProjectMetricsPage,
  staticData: { breadcrumb: "Metrics" },
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as string) || undefined,
  }),
});

// /projects/$projectId/metrics/cost (F-146)
const projectCostRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/metrics/cost",
  component: CostDashboardPage,
  staticData: { breadcrumb: "Cost" },
});

// /projects/$projectId/harness/pipeline/model-config (F-166)
const pipelineModelConfigRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/harness/pipeline/model-config",
  component: PipelineModelConfigPage,
  staticData: { breadcrumb: "Model Config" },
});

// /projects/$projectId/harness/board (F-161)
const projectBoardRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/harness/board",
  component: AgenticBoardPage,
  staticData: { breadcrumb: "Board" },
  validateSearch: (search: Record<string, unknown>) => ({
    sprint: (search.sprint as string) || undefined,
  }),
});

// /projects/$projectId/harness/board/config (F-162)
const boardConfigRoute2 = createRoute({
  getParentRoute: () => projectRoute,
  path: "/harness/board/config",
  component: BoardConfigPage,
  staticData: { breadcrumb: "Board Config" },
  validateSearch: (search: Record<string, unknown>) => ({
    sprint: (search.sprint as string) || undefined,
  }),
});

// /projects/$projectId/settings
const projectSettingsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/settings",
  component: ProjectSettingsPage,
  staticData: { breadcrumb: "Settings" },
});

// /projects/$projectId/sources/$sourceId/graph-config (F-171)
const graphConfigRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/sources/$sourceId/graph-config",
  component: GraphConfigPage,
  staticData: { breadcrumb: "Graph Config" },
});

// /projects/$projectId/settings/quality-gates (F-176)
const qualityGatesSettingsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/settings/quality-gates",
  component: QualityGatesSettingsPage,
  staticData: { breadcrumb: "Quality Gates" },
});

// /projects/$projectId/settings/mcp/$serverId (F-083)
const mcpServerDetailRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/settings/mcp/$serverId",
  component: McpServerDetailPage,
  staticData: { breadcrumb: "MCP Server" },
});

// /harness
const harnessRoute = createRoute({
  getParentRoute: () => authenticatedLayout,
  path: "/harness",
  component: HarnessOverviewPage,
  staticData: { breadcrumb: "Harness" },
});

// /harness/$projectId — workspace detail (F-042)
const harnessDetailRoute = createRoute({
  getParentRoute: () => harnessRoute,
  path: "$projectId",
  component: WorkspaceDetailPage,
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
        projectHandoffNewRoute,
        projectHandoffRoute,
        projectACRsRoute,
        acrDetailRoute,
        projectPipelineRoute,
        projectReviewsRoute,
        reviewPanelRoute,
        projectMetricsRoute,
        projectCostRoute,
        projectBoardRoute,
        boardConfigRoute2,
        pipelineModelConfigRoute,
        graphConfigRoute,
        projectSettingsRoute,
        qualityGatesSettingsRoute,
        mcpServerDetailRoute,
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

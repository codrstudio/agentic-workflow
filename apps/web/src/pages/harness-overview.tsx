import { Link, Outlet, useMatches } from "@tanstack/react-router";
import { Activity, Layers, Play, CircleDot } from "lucide-react";
import { useProjects, type Project } from "@/hooks/use-projects";
import {
  useAllHarnessStatuses,
  type WorkspaceStatus,
  type StepInfo,
} from "@/hooks/use-harness";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function getRunningStep(status: WorkspaceStatus): StepInfo | null {
  if (!status.waves.length) return null;
  const currentWave = status.waves[status.waves.length - 1];
  if (!currentWave) return null;
  return currentWave.steps.find((s) => s.status === "running") ?? null;
}

function getStepProgress(status: WorkspaceStatus): {
  completed: number;
  total: number;
} {
  if (!status.waves.length) return { completed: 0, total: 0 };
  const currentWave = status.waves[status.waves.length - 1];
  if (!currentWave) return { completed: 0, total: 0 };
  const completed = currentWave.steps.filter(
    (s) => s.status === "completed"
  ).length;
  return { completed, total: currentWave.steps.length };
}

type HarnessStatusType = "running" | "completed" | "failed" | "idle";

function StatusBadge({ status }: { status: HarnessStatusType }) {
  const config: Record<
    HarnessStatusType,
    { label: string; className: string }
  > = {
    running: {
      label: "Running",
      className:
        "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    },
    completed: {
      label: "Completed",
      className:
        "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400",
    },
    idle: {
      label: "Idle",
      className:
        "border-gray-500/30 bg-gray-500/10 text-gray-700 dark:text-gray-400",
    },
    failed: {
      label: "Failed",
      className:
        "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
    },
  };

  const cfg = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1", cfg.className)}>
      {status === "running" && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
      )}
      {cfg.label}
    </Badge>
  );
}

function HarnessProjectCard({
  projectName,
  projectSlug,
  status,
}: {
  projectName: string;
  projectSlug: string;
  status: WorkspaceStatus;
}) {
  const runningStep = getRunningStep(status);
  const progress = getStepProgress(status);

  return (
    <Link
      to="/harness/$projectId"
      params={{ projectId: projectSlug }}
      className="group flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-semibold text-card-foreground group-hover:text-primary transition-colors">
            {projectName}
          </h3>
        </div>
        <StatusBadge status={status.status} />
      </div>

      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Layers className="h-3.5 w-3.5" />
          <span>
            Wave {status.current_wave ?? "-"}
          </span>
        </div>

        {runningStep && (
          <div className="flex items-center gap-2">
            <Play className="h-3.5 w-3.5 text-green-500" />
            <span className="truncate">
              Step {runningStep.number}: {runningStep.name}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <CircleDot className="h-3.5 w-3.5" />
          <span>
            {progress.completed}/{progress.total} steps completed
          </span>
        </div>

        {progress.total > 0 && (
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                status.status === "failed"
                  ? "bg-red-500"
                  : status.status === "running"
                    ? "bg-green-500"
                    : "bg-primary"
              )}
              style={{
                width: `${Math.round((progress.completed / progress.total) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    </Link>
  );
}

export function HarnessOverviewPage() {
  const matches = useMatches();
  // If we have a child route (e.g. /harness/$projectId), render it
  const hasChildRoute = matches.some((m) => m.pathname.match(/^\/harness\/[^/]+/));
  if (hasChildRoute) {
    return <Outlet />;
  }

  return <HarnessListView />;
}

function HarnessListView() {
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const statusQueries = useAllHarnessStatuses(projects);

  const isLoading =
    projectsLoading || statusQueries.some((q) => q.isLoading);

  // Pair projects with their harness status (only those with a workspace)
  const projectsWithStatus: Array<{
    project: Project;
    status: WorkspaceStatus;
  }> = [];

  if (projects) {
    for (let i = 0; i < projects.length; i++) {
      const project = projects[i]!;
      const query = statusQueries[i];
      if (query?.data) {
        projectsWithStatus.push({ project, status: query.data });
      }
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="h-6 w-6" />
          Harness
        </h1>
        <p className="text-sm text-muted-foreground">
          Monitor workflow execution across projects
        </p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-lg border bg-muted"
            />
          ))}
        </div>
      )}

      {!isLoading && projectsWithStatus.length === 0 && (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-muted-foreground">
          <Activity className="h-10 w-10 opacity-30" />
          <p className="text-sm">No active workspaces found</p>
        </div>
      )}

      {!isLoading && projectsWithStatus.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projectsWithStatus.map(({ project, status }) => (
            <HarnessProjectCard
              key={project.slug}
              projectName={project.name}
              projectSlug={project.slug}
              status={status}
            />
          ))}
        </div>
      )}
    </div>
  );
}

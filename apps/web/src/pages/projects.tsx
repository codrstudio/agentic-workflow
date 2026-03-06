import { Outlet, useMatches } from "@tanstack/react-router";
import { FolderPlus, FolderOpen, Plus } from "lucide-react";
import { useProjects } from "@/hooks/use-projects";
import { ProjectCard } from "@/components/project-card";
import { ProjectGridSkeleton } from "@/components/project-card-skeleton";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export function ProjectsPage() {
  const matches = useMatches();
  const hasChildRoute = matches.length > 3;

  if (hasChildRoute) {
    return <Outlet />;
  }

  return <ProjectListView />;
}

function ProjectListView() {
  const { data: projects, isLoading, isError, error } = useProjects();

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage your projects and workspaces
          </p>
        </div>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {/* Content */}
      {isLoading && <ProjectGridSkeleton />}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load projects: {error.message}
        </div>
      )}

      {!isLoading && !isError && projects && projects.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to start organizing sources, chatting with AI, and generating artifacts."
          actionLabel="Novo Projeto"
          onAction={() => {
            // F-012 will implement the create dialog
          }}
          className="min-h-[50vh]"
        />
      )}

      {!isLoading && !isError && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

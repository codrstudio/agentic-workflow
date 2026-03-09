import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FolderOpen, Plus } from "lucide-react";
import { useProjects, type Project } from "@/hooks/use-projects";
import { ProjectCard } from "@/components/project-card";
import { ProjectGridSkeleton } from "@/components/project-card-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/project-form-dialog";
import { ProjectDeleteDialog } from "@/components/project-delete-dialog";

export const Route = createFileRoute("/web/projects/overview")({
  component: ProjectOverviewPage,
});

function ProjectOverviewPage() {
  const { data: projects, isLoading, isError, error } = useProjects();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Project | undefined>();

  function openCreate() {
    setEditingProject(undefined);
    setDialogOpen(true);
  }

  function openEdit(project: Project) {
    setEditingProject(project);
    setDialogOpen(true);
  }

  function openDelete(project: Project) {
    setDeletingProject(project);
    setDeleteDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie seus projetos e workspaces
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Novo Projeto
        </Button>
      </div>

      {/* Content */}
      {isLoading && <ProjectGridSkeleton />}

      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao carregar projetos: {error?.message}
        </div>
      )}

      {!isLoading && !isError && projects && projects.length === 0 && (
        <EmptyState
          icon={FolderOpen}
          title="Nenhum projeto ainda"
          description="Crie seu primeiro projeto para começar a organizar fontes, conversar com IA e gerar artefatos."
          actionLabel="Novo Projeto"
          onAction={openCreate}
          className="min-h-[50vh]"
        />
      )}

      {!isLoading && !isError && projects && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onEdit={openEdit} onDelete={openDelete} />
          ))}
        </div>
      )}

      <ProjectFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        project={editingProject}
      />

      <ProjectDeleteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        project={deletingProject}
      />
    </div>
  );
}

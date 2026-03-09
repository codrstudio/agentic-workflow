import { useNavigate } from "@tanstack/react-router";
import { useDeleteProject, type Project } from "@/hooks/use-projects";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProjectDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | undefined;
}

export function ProjectDeleteDialog({
  open,
  onOpenChange,
  project,
}: ProjectDeleteDialogProps) {
  const deleteMutation = useDeleteProject();
  const navigate = useNavigate();

  function handleConfirm() {
    if (!project) return;
    deleteMutation.mutate(project.slug, {
      onSuccess: () => {
        onOpenChange(false);
        navigate({ to: "/projects" });
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
          <AlertDialogDescription>
            Tem certeza que deseja excluir o projeto{" "}
            <strong className="text-foreground">{project?.name}</strong>? Esta
            acao nao pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.isError && (
          <p className="text-sm text-destructive">
            {deleteMutation.error.message}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

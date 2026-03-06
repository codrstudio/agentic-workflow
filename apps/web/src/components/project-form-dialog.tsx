import { useState, useEffect } from "react";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCreateProject,
  useUpdateProject,
  type Project,
} from "@/hooks/use-projects";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const projectFormSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(100),
  description: z.string().max(500).optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: Project;
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
}: ProjectFormDialogProps) {
  const isMobile = useIsMobile();
  const isEdit = !!project;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();

  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (open) {
      setName(project?.name ?? "");
      setDescription(project?.description ?? "");
      setErrors({});
      createMutation.reset();
      updateMutation.reset();
    }
  }, [open, project]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const result = projectFormSchema.safeParse({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key && typeof key === "string") {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    const data: ProjectFormData = result.data;

    if (isEdit) {
      updateMutation.mutate(
        { slug: project.slug, body: data },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(data, {
        onSuccess: () => onOpenChange(false),
      });
    }
  }

  const title = isEdit ? "Editar Projeto" : "Novo Projeto";
  const submitLabel = isEdit ? "Salvar" : "Criar";

  const formContent = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-name">Nome *</Label>
        <Input
          id="project-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do projeto"
          aria-invalid={!!errors["name"]}
          autoFocus
        />
        {errors["name"] && (
          <p className="text-sm text-destructive">{errors["name"]}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="project-description">Descricao</Label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descricao do projeto (opcional)"
          rows={3}
        />
        {errors["description"] && (
          <p className="text-sm text-destructive">{errors["description"]}</p>
        )}
      </div>
      {(createMutation.isError || updateMutation.isError) && (
        <p className="text-sm text-destructive">
          {createMutation.error?.message ?? updateMutation.error?.message}
        </p>
      )}
    </form>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[85vh]">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {isEdit
                ? "Altere os dados do projeto"
                : "Preencha os dados para criar um novo projeto"}
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">{formContent}</div>
          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Salvando..." : submitLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Altere os dados do projeto"
              : "Preencha os dados para criar um novo projeto"}
          </DialogDescription>
        </DialogHeader>
        {formContent}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Salvando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

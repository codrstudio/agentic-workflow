import { useState, useEffect } from "react";
import { z } from "zod";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  useCreateArtifact,
  type ArtifactType,
} from "@/hooks/use-artifacts";
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
import { Badge } from "@/components/ui/badge";

const ARTIFACT_TYPES: { value: ArtifactType; label: string }[] = [
  { value: "document", label: "Document" },
  { value: "code", label: "Code" },
  { value: "json", label: "JSON" },
  { value: "config", label: "Config" },
  { value: "diagram", label: "Diagram" },
];

const formSchema = z.object({
  name: z.string().min(1, "Nome e obrigatorio").max(200),
  type: z.enum(["document", "code", "json", "config", "diagram"]),
  content: z.string().min(1, "Conteudo e obrigatorio"),
});

interface CreateArtifactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
}

export function CreateArtifactDialog({
  open,
  onOpenChange,
  projectSlug,
}: CreateArtifactDialogProps) {
  const isMobile = useIsMobile();
  const createMutation = useCreateArtifact(projectSlug);

  const [name, setName] = useState("");
  const [type, setType] = useState<ArtifactType>("document");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName("");
      setType("document");
      setContent("");
      setTags([]);
      setTagInput("");
      setErrors({});
      createMutation.reset();
    }
  }, [open]);

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  }

  function handleSubmit() {
    setErrors({});
    const result = formSchema.safeParse({
      name: name.trim(),
      type,
      content,
    });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0];
        if (key && typeof key === "string") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    createMutation.mutate(
      {
        name: result.data.name,
        type: result.data.type,
        content: result.data.content,
        origin: "manual",
        tags: tags.length > 0 ? tags : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  const formContent = (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="artifact-name">Nome *</Label>
        <Input
          id="artifact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome do artifact"
          aria-invalid={!!errors["name"]}
        />
        {errors["name"] && (
          <p className="text-sm text-destructive">{errors["name"]}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="artifact-type">Tipo</Label>
        <select
          id="artifact-type"
          value={type}
          onChange={(e) => setType(e.target.value as ArtifactType)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          {ARTIFACT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="artifact-content">Conteudo *</Label>
        <Textarea
          id="artifact-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Conteudo do artifact..."
          rows={10}
          aria-invalid={!!errors["content"]}
        />
        {errors["content"] && (
          <p className="text-sm text-destructive">{errors["content"]}</p>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Tags</Label>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="ml-0.5 rounded-full hover:bg-muted"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="Add tag + Enter"
            className="h-7 w-32 text-xs"
          />
        </div>
      </div>
    </div>
  );

  const footer = (
    <>
      {createMutation.isError && (
        <p className="text-sm text-destructive">{createMutation.error?.message}</p>
      )}
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={createMutation.isPending}>
        Cancelar
      </Button>
      <Button onClick={handleSubmit} disabled={createMutation.isPending}>
        {createMutation.isPending ? "Criando..." : "Criar Artifact"}
      </Button>
    </>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Criar Artifact</SheetTitle>
            <SheetDescription>
              Crie um novo artifact manualmente
            </SheetDescription>
          </SheetHeader>
          <div className="px-4">{formContent}</div>
          <SheetFooter>{footer}</SheetFooter>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar Artifact</DialogTitle>
          <DialogDescription>
            Crie um novo artifact manualmente
          </DialogDescription>
        </DialogHeader>
        {formContent}
        <DialogFooter>{footer}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

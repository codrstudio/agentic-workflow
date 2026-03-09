import { useState, useEffect } from "react";
import { Wand2, Brain, FileText, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useClassifyTask,
  useGetTemplate,
  type TaskComplexity,
  type ComplexityLevel,
  type SpecTemplate,
} from "@/hooks/use-task-complexity";
import { useCreateArtifact } from "@/hooks/use-artifacts";

interface TaskComplexityClassifierProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectSlug: string;
}

const LEVEL_CONFIG: Record<
  ComplexityLevel,
  { label: string; color: string; estimate: string }
> = {
  trivial: {
    label: "Trivial",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    estimate: "5-15 min",
  },
  small: {
    label: "Small",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    estimate: "15-30 min",
  },
  medium: {
    label: "Medium",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    estimate: "1-2h",
  },
  large: {
    label: "Large",
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    estimate: "2-4h",
  },
};

const TEMPLATE_LABELS: Record<string, string> = {
  checklist: "Checklist",
  spec_resumida: "Spec Resumida",
  spec_completa: "Spec Completa",
  prp_completo: "PRP Completo",
};

export function TaskComplexityClassifier({
  open,
  onOpenChange,
  projectSlug,
}: TaskComplexityClassifierProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<TaskComplexity | null>(null);
  const [templateData, setTemplateData] = useState<(SpecTemplate & { markdown_template: string }) | null>(null);

  const classifyMutation = useClassifyTask(projectSlug);
  const templateMutation = useGetTemplate(projectSlug);
  const createArtifact = useCreateArtifact(projectSlug);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setResult(null);
      setTemplateData(null);
      classifyMutation.reset();
      templateMutation.reset();
      createArtifact.reset();
    }
  }, [open]);

  const handleClassify = async (
    method: "auto_heuristic" | "auto_ai",
  ) => {
    if (!title.trim()) {
      toast.error("Titulo e obrigatorio");
      return;
    }

    classifyMutation.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        method,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          templateMutation.mutate(data.complexity_level, {
            onSuccess: (tmpl) => setTemplateData(tmpl),
          });
        },
      },
    );
  };

  const handleManualClassify = (level: ComplexityLevel) => {
    if (!title.trim()) {
      toast.error("Titulo e obrigatorio");
      return;
    }

    classifyMutation.mutate(
      {
        title: title.trim(),
        description: description.trim(),
        method: "manual",
        complexity_level: level,
      },
      {
        onSuccess: (data) => {
          setResult(data);
          templateMutation.mutate(data.complexity_level, {
            onSuccess: (tmpl) => setTemplateData(tmpl),
          });
        },
      },
    );
  };

  const handleGenerateSpec = () => {
    if (!result || !templateData) return;

    const content = templateData.markdown_template.replace(
      "{titulo}",
      result.title,
    );

    createArtifact.mutate(
      {
        name: `Spec: ${result.title}`,
        type: "document",
        content,
        origin: "manual",
        tags: [
          `complexity:${result.complexity_level}`,
          `template:${result.spec_template}`,
        ],
      },
      {
        onSuccess: () => {
          toast.success("Spec gerada como artifact", {
            description: `Template: ${TEMPLATE_LABELS[result.spec_template] ?? result.spec_template}`,
          });
          onOpenChange(false);
        },
      },
    );
  };

  const isClassifying = classifyMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription>
            Classifique a complexidade para obter o template de spec adequado
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {/* Title input */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Titulo *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Adicionar filtro de busca na lista de projetos"
              disabled={isClassifying}
            />
          </div>

          {/* Description textarea */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Descricao</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva brevemente o que precisa ser feito..."
              rows={3}
              disabled={isClassifying}
            />
          </div>

          {/* Classification buttons */}
          <div className="flex flex-col gap-3">
            <Label>Classificacao</Label>

            {/* Auto + AI buttons */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => handleClassify("auto_heuristic")}
                disabled={isClassifying || !title.trim()}
                className="justify-start gap-2"
              >
                {isClassifying && classifyMutation.variables?.method === "auto_heuristic" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Wand2 className="h-4 w-4" />
                )}
                Auto-classificar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleClassify("auto_ai")}
                disabled={isClassifying || !title.trim()}
                className="justify-start gap-2"
              >
                {isClassifying && classifyMutation.variables?.method === "auto_ai" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Brain className="h-4 w-4" />
                )}
                Classificar com AI
              </Button>
            </div>

            {/* Manual level buttons */}
            <div className="grid grid-cols-4 gap-2">
              {(
                ["trivial", "small", "medium", "large"] as ComplexityLevel[]
              ).map((level) => {
                const cfg = LEVEL_CONFIG[level];
                return (
                  <Button
                    key={level}
                    variant="outline"
                    size="sm"
                    onClick={() => handleManualClassify(level)}
                    disabled={isClassifying || !title.trim()}
                    className="flex flex-col items-center gap-0.5 h-auto py-2"
                  >
                    <span className="text-xs font-medium">{cfg.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {cfg.estimate}
                    </span>
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {classifyMutation.isError && (
            <p className="text-sm text-destructive">
              {classifyMutation.error?.message ?? "Erro ao classificar"}
            </p>
          )}

          {/* Result card */}
          {result && (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Resultado</span>
                </div>
                <Badge
                  className={LEVEL_CONFIG[result.complexity_level].color}
                >
                  {LEVEL_CONFIG[result.complexity_level].label}
                </Badge>
              </div>

              {/* Confidence (for AI classification) */}
              {result.confidence != null && (
                <div className="flex items-center gap-2 mb-2 text-sm text-muted-foreground">
                  <span>Confianca:</span>
                  <span className="font-medium">
                    {Math.round(result.confidence * 100)}%
                  </span>
                </div>
              )}

              {/* Template info */}
              <div className="flex items-center gap-2 mb-2 text-sm">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span>Template:</span>
                <span className="font-medium">
                  {TEMPLATE_LABELS[result.spec_template] ?? result.spec_template}
                </span>
              </div>

              {/* Estimated effort */}
              <div className="flex items-center gap-2 mb-3 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Esforco estimado:</span>
                <span className="font-medium">
                  {LEVEL_CONFIG[result.complexity_level].estimate}
                </span>
              </div>

              {/* Required sections */}
              {templateData && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    Secoes obrigatorias:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {templateData.required_sections.map((section) => (
                      <Badge
                        key={section}
                        variant="secondary"
                        className="text-xs"
                      >
                        {section}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          {result && templateData && (
            <Button
              onClick={handleGenerateSpec}
              disabled={createArtifact.isPending}
              className="gap-2"
            >
              {createArtifact.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              Gerar spec
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

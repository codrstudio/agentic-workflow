import { useState, useMemo, useEffect } from "react";
import { RotateCcw, Plus, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ComplexityBadge } from "@/components/complexity-badge";
import {
  useAllTemplates,
  useUpdateTemplates,
  type SpecTemplate,
  type ComplexityLevel,
} from "@/hooks/use-task-complexity";
import { cn } from "@/lib/utils";

const LEVELS: { level: ComplexityLevel; label: string }[] = [
  { level: "trivial", label: "Trivial" },
  { level: "small", label: "Small" },
  { level: "medium", label: "Medium" },
  { level: "large", label: "Large" },
];

const DEFAULT_TEMPLATES: SpecTemplate[] = [
  {
    level: "trivial",
    template_name: "checklist",
    required_sections: ["Titulo", "Descricao", "Criterios (3-5)"],
    optional_sections: ["Rastreabilidade"],
    estimated_effort: "5-15 min",
  },
  {
    level: "small",
    template_name: "spec_resumida",
    required_sections: ["Objetivo", "Criterios de Aceite", "Rastreabilidade"],
    optional_sections: ["Modelo de Dados", "Notas"],
    estimated_effort: "15-30 min",
  },
  {
    level: "medium",
    template_name: "spec_completa",
    required_sections: [
      "Objetivo",
      "Modelo de Dados",
      "API",
      "Telas",
      "Criterios",
      "Rastreabilidade",
    ],
    optional_sections: ["Componentes", "Data Layer"],
    estimated_effort: "1-2h",
  },
  {
    level: "large",
    template_name: "prp_completo",
    required_sections: [
      "User Stories",
      "ER Diagram",
      "Design",
      "Specs derivadas",
      "Features",
      "Criterios",
    ],
    optional_sections: ["Riscos", "Dependencias"],
    estimated_effort: "2-4h",
  },
];

function renderMarkdownPreview(template: SpecTemplate): string {
  const lines: string[] = [];
  lines.push("# {titulo}");
  lines.push("");

  for (const section of template.required_sections) {
    lines.push(`## ${section}`);
    lines.push("");
    lines.push(`<!-- Preencha: ${section} -->`);
    lines.push("");
  }

  if (template.optional_sections.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("*Secoes opcionais:*");
    lines.push("");
    for (const section of template.optional_sections) {
      lines.push(`## ${section}`);
      lines.push("");
      lines.push(`<!-- Opcional: ${section} -->`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

interface SpecTemplateEditorProps {
  projectSlug: string;
}

export function SpecTemplateEditor({ projectSlug }: SpecTemplateEditorProps) {
  const { data: templates, isLoading } = useAllTemplates(projectSlug);
  const updateTemplates = useUpdateTemplates(projectSlug);
  const [activeLevel, setActiveLevel] = useState<ComplexityLevel>("trivial");
  const [localTemplates, setLocalTemplates] = useState<SpecTemplate[] | null>(
    null
  );
  const [newSectionName, setNewSectionName] = useState("");

  // Sync remote templates to local state
  useEffect(() => {
    if (templates && !localTemplates) {
      setLocalTemplates(templates);
    }
  }, [templates, localTemplates]);

  const currentTemplate = useMemo(
    () =>
      (localTemplates ?? templates)?.find((t) => t.level === activeLevel) ??
      null,
    [localTemplates, templates, activeLevel]
  );

  const defaultTemplate = DEFAULT_TEMPLATES.find(
    (t) => t.level === activeLevel
  );

  const isModified = useMemo(() => {
    if (!currentTemplate || !defaultTemplate) return false;
    return (
      JSON.stringify(currentTemplate.required_sections) !==
        JSON.stringify(defaultTemplate.required_sections) ||
      JSON.stringify(currentTemplate.optional_sections) !==
        JSON.stringify(defaultTemplate.optional_sections) ||
      currentTemplate.estimated_effort !== defaultTemplate.estimated_effort
    );
  }, [currentTemplate, defaultTemplate]);

  const markdownPreview = useMemo(
    () => (currentTemplate ? renderMarkdownPreview(currentTemplate) : ""),
    [currentTemplate]
  );

  function updateCurrentTemplate(updates: Partial<SpecTemplate>) {
    setLocalTemplates((prev) => {
      const base = prev ?? templates ?? DEFAULT_TEMPLATES;
      return base.map((t) =>
        t.level === activeLevel ? { ...t, ...updates } : t
      );
    });
  }

  function handleSave() {
    if (!localTemplates) return;
    updateTemplates.mutate(localTemplates, {
      onSuccess: (data) => {
        setLocalTemplates(data);
      },
    });
  }

  function handleRestoreDefaults() {
    if (!defaultTemplate) return;
    updateCurrentTemplate({
      required_sections: [...defaultTemplate.required_sections],
      optional_sections: [...defaultTemplate.optional_sections],
      estimated_effort: defaultTemplate.estimated_effort,
    });
  }

  function removeSection(
    type: "required" | "optional",
    sectionName: string
  ) {
    if (!currentTemplate) return;
    const key =
      type === "required" ? "required_sections" : "optional_sections";
    updateCurrentTemplate({
      [key]: currentTemplate[key].filter((s) => s !== sectionName),
    });
  }

  function toggleSectionType(
    currentType: "required" | "optional",
    sectionName: string
  ) {
    if (!currentTemplate) return;
    const fromKey =
      currentType === "required" ? "required_sections" : "optional_sections";
    const toKey =
      currentType === "required" ? "optional_sections" : "required_sections";
    updateCurrentTemplate({
      [fromKey]: currentTemplate[fromKey].filter((s) => s !== sectionName),
      [toKey]: [...currentTemplate[toKey], sectionName],
    });
  }

  function addSection() {
    const name = newSectionName.trim();
    if (!name || !currentTemplate) return;
    updateCurrentTemplate({
      optional_sections: [...currentTemplate.optional_sections, name],
    });
    setNewSectionName("");
  }

  const hasChanges = useMemo(() => {
    if (!localTemplates || !templates) return false;
    return JSON.stringify(localTemplates) !== JSON.stringify(templates);
  }, [localTemplates, templates]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-5" />
          <h2 className="text-base font-semibold">Spec Templates</h2>
        </div>
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateTemplates.isPending}
          >
            {updateTemplates.isPending ? "Salvando..." : "Salvar alteracoes"}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Configure os templates de especificacao por nivel de complexidade.
      </p>

      {/* Level tabs */}
      <div className="flex gap-1 border-b">
        {LEVELS.map(({ level, label }) => (
          <button
            key={level}
            type="button"
            onClick={() => setActiveLevel(level)}
            className={cn(
              "px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeLevel === level
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="flex items-center gap-1.5">
              {label}
              <ComplexityBadge level={level} />
            </span>
          </button>
        ))}
      </div>

      {currentTemplate && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: sections editor */}
          <div className="space-y-4">
            {/* Estimated effort */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Esforco estimado
              </label>
              <Input
                value={currentTemplate.estimated_effort}
                onChange={(e) =>
                  updateCurrentTemplate({
                    estimated_effort: e.target.value,
                  })
                }
                className="h-8 text-sm"
              />
            </div>

            {/* Required sections */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Secoes obrigatorias
              </label>
              <div className="space-y-1.5">
                {currentTemplate.required_sections.map((section) => (
                  <div
                    key={section}
                    className="flex items-center gap-2 group"
                  >
                    <Checkbox checked disabled />
                    <span className="text-sm flex-1">{section}</span>
                    <button
                      type="button"
                      onClick={() =>
                        toggleSectionType("required", section)
                      }
                      className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                      title="Tornar opcional"
                    >
                      opcional?
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        removeSection("required", section)
                      }
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Optional sections */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Secoes opcionais
              </label>
              <div className="space-y-1.5">
                {currentTemplate.optional_sections.map((section) => (
                  <div
                    key={section}
                    className="flex items-center gap-2 group"
                  >
                    <Checkbox checked={false} disabled />
                    <span className="text-sm flex-1 text-muted-foreground">
                      {section}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        toggleSectionType("optional", section)
                      }
                      className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
                      title="Tornar obrigatoria"
                    >
                      obrigatoria?
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        removeSection("optional", section)
                      }
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Add section */}
            <div className="flex gap-2">
              <Input
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Nova secao..."
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSection();
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-2"
                onClick={addSection}
                disabled={!newSectionName.trim()}
              >
                <Plus className="size-3.5" />
              </Button>
            </div>

            {/* Restore defaults */}
            {isModified && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={handleRestoreDefaults}
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Restaurar defaults
              </Button>
            )}
          </div>

          {/* Right: markdown preview */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Preview do template
            </label>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm font-mono whitespace-pre-wrap max-h-[400px] overflow-y-auto">
              {markdownPreview}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

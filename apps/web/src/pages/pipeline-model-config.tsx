import { useState, useMemo } from "react";
import { useParams } from "@tanstack/react-router";
import { Save, Trash2, Cpu, Lightbulb, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useModelCatalog,
  usePhaseModelConfig,
  usePatchPhaseModelConfig,
  type ModelCatalogEntry,
  type StepModelOverride,
} from "@/hooks/use-model-config";
import { useHarnessStatus, type StepInfo } from "@/hooks/use-harness";
import { useModelRecommendations } from "@/hooks/use-cost-metrics";
import { cn } from "@/lib/utils";

// --- Cost tier colors ---

const COST_TIER_STYLES: Record<string, string> = {
  low: "bg-green-500/10 text-green-700 dark:text-green-400",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  high: "bg-red-500/10 text-red-700 dark:text-red-400",
};

const QUALITY_TIER_STYLES: Record<string, string> = {
  standard: "bg-slate-500/10 text-slate-700 dark:text-slate-400",
  premium: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

// --- Helpers ---

function getModelById(
  catalog: ModelCatalogEntry[],
  modelId: string
): ModelCatalogEntry | undefined {
  return catalog.find((m) => m.id === modelId);
}

function getEffectiveCostTier(
  catalog: ModelCatalogEntry[],
  yamlModel: string | undefined,
  override: StepModelOverride | undefined
): string {
  const effectiveModelId = override?.model ?? yamlModel;
  if (!effectiveModelId) return "medium"; // default sonnet
  const entry = getModelById(catalog, effectiveModelId);
  return entry?.cost_tier ?? "medium";
}

// --- Available workflows (derived from known workflow files) ---

const KNOWN_WORKFLOWS = [
  { slug: "vibe-app", label: "Vibe App" },
];

export function PipelineModelConfigPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/harness/pipeline/model-config",
  });

  // State
  const [selectedWorkflow, setSelectedWorkflow] = useState(KNOWN_WORKFLOWS[0]!.slug);
  const [localOverrides, setLocalOverrides] = useState<Record<string, StepModelOverride>>({});
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Queries
  const { data: catalog = [], isLoading: catalogLoading } = useModelCatalog();
  const { data: configData, isLoading: configLoading } = usePhaseModelConfig(projectId, selectedWorkflow);
  const { data: harnessData, isLoading: harnessLoading } = useHarnessStatus(projectId);
  const { data: recommendations } = useModelRecommendations(projectId);
  const patchMutation = usePatchPhaseModelConfig(projectId, selectedWorkflow);

  // Derive steps from harness status (use latest wave)
  const steps = useMemo<StepInfo[]>(() => {
    if (!harnessData?.waves?.length) return [];
    const latestWave = harnessData.waves[harnessData.waves.length - 1]!;
    return latestWave.steps;
  }, [harnessData]);

  // Sync server overrides into local state when config loads (and not dirty)
  const serverOverrides = configData?.step_overrides ?? {};
  const effectiveOverrides = dirty ? localOverrides : serverOverrides;

  // --- Handlers ---

  function handleOverrideChange(stepName: string, modelId: string | null) {
    setDirty(true);
    setFeedback(null);
    setLocalOverrides((prev) => {
      const next = { ...prev };
      if (modelId === null) {
        delete next[stepName];
      } else {
        next[stepName] = { model: modelId };
      }
      return next;
    });
  }

  function handleSave() {
    setFeedback(null);
    patchMutation.mutate(localOverrides, {
      onSuccess: () => {
        setDirty(false);
        setFeedback({ type: "success", message: "Overrides salvos com sucesso." });
      },
      onError: (err) => {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Erro ao salvar." });
      },
    });
  }

  function handleClearAll() {
    setFeedback(null);
    patchMutation.mutate({}, {
      onSuccess: () => {
        setLocalOverrides({});
        setDirty(false);
        setFeedback({ type: "success", message: "Todos os overrides foram removidos." });
      },
      onError: (err) => {
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Erro ao limpar." });
      },
    });
  }

  function handleWorkflowChange(slug: string) {
    setSelectedWorkflow(slug);
    setLocalOverrides({});
    setDirty(false);
    setFeedback(null);
  }

  const isLoading = catalogLoading || configLoading || harnessLoading;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Model Config</h1>
          <p className="text-sm text-muted-foreground">
            Configure model overrides per pipeline step
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Workflow selector */}
          <select
            value={selectedWorkflow}
            onChange={(e) => handleWorkflowChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            {KNOWN_WORKFLOWS.map((w) => (
              <option key={w.slug} value={w.slug}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Inline feedback */}
      {feedback && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border p-3 text-sm",
            feedback.type === "success"
              ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400"
              : "border-destructive/50 bg-destructive/10 text-destructive"
          )}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {feedback.message}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* Steps table */}
      {!isLoading && steps.length > 0 && (
        <div className="rounded-lg border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fase / Step</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Modelo YAML</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Override do projeto</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Custo estimado</th>
                </tr>
              </thead>
              <tbody>
                {steps.map((step) => {
                  const override = effectiveOverrides[step.name];
                  const costTier = getEffectiveCostTier(catalog, undefined, override);
                  return (
                    <tr key={step.number} className="border-b last:border-b-0 hover:bg-muted/30">
                      {/* Step name */}
                      <td className="px-4 py-3">
                        <div className="font-medium">{step.name}</div>
                        <div className="text-xs text-muted-foreground">{step.type}</div>
                      </td>

                      {/* YAML model (readonly) */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          —
                        </span>
                      </td>

                      {/* Override dropdown */}
                      <td className="px-4 py-3">
                        <select
                          value={override?.model ?? ""}
                          onChange={(e) =>
                            handleOverrideChange(
                              step.name,
                              e.target.value === "" ? null : e.target.value
                            )
                          }
                          className="h-8 w-full max-w-[220px] rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        >
                          <option value="">Usar YAML default</option>
                          {catalog.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Cost badge */}
                      <td className="px-4 py-3">
                        <Badge
                          variant="secondary"
                          className={cn("text-xs", COST_TIER_STYLES[costTier])}
                        >
                          {costTier}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearAll}
              disabled={patchMutation.isPending}
              className="gap-1.5"
            >
              <Trash2 className="size-4" />
              Limpar todos os overrides
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!dirty || patchMutation.isPending}
              className="gap-1.5"
            >
              <Save className="size-4" />
              Salvar overrides
            </Button>
          </div>
        </div>
      )}

      {/* No steps */}
      {!isLoading && steps.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card py-12">
          <Cpu className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhum step encontrado. Execute o pipeline para ver os steps aqui.
          </p>
        </div>
      )}

      {/* Model Recommendations section */}
      {recommendations && recommendations.length > 0 && (
        <div className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb className="size-5 text-yellow-500" />
            <h2 className="text-lg font-semibold">Modelos Recomendados por Fase</h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recommendations.map((rec) => {
              const model = catalog.find((m) => m.id === rec.recommended_model);
              return (
                <div
                  key={rec.phase}
                  className="rounded-lg border bg-background p-4"
                >
                  <div className="mb-2 text-sm font-semibold capitalize">
                    {rec.phase}
                  </div>
                  <div className="mb-1 text-sm text-foreground">
                    {model?.display_name ?? rec.recommended_model}
                  </div>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {rec.rationale}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        COST_TIER_STYLES[rec.cost_tier] ?? ""
                      )}
                    >
                      {rec.cost_tier}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        QUALITY_TIER_STYLES[rec.quality_tier] ?? ""
                      )}
                    >
                      {rec.quality_tier}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

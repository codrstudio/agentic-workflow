import { Bot } from "lucide-react";
import { useFeatureAttributions } from "@/hooks/use-model-attributions";

// --- Helpers ---

function modelDisplayName(modelId: string): string {
  if (modelId.includes("haiku")) return "Haiku 4.5";
  if (modelId.includes("sonnet")) return "Sonnet 4.6";
  if (modelId.includes("opus")) return "Opus 4.6";
  return modelId;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Component ---

interface ModelAttributionTabProps {
  projectSlug: string;
  featureId: string;
}

export function ModelAttributionTab({ projectSlug, featureId }: ModelAttributionTabProps) {
  const { data: attributions, isLoading } = useFeatureAttributions(projectSlug, featureId);

  if (isLoading) {
    return (
      <div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Bot className="size-3" /> Modelos
        </span>
        <p className="text-xs text-muted-foreground mt-1">Carregando...</p>
      </div>
    );
  }

  if (!attributions || attributions.length === 0) {
    return (
      <div>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Bot className="size-3" /> Modelos
        </span>
        <p className="text-xs text-muted-foreground mt-1">Nenhuma attribution registrada</p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Bot className="size-3" /> Modelos
      </span>
      <div className="mt-1 overflow-x-auto rounded border">
        <table className="w-full text-xs">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Phase</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Step</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Modelo</th>
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Data</th>
            </tr>
          </thead>
          <tbody>
            {attributions.map((attr) => (
              <tr key={attr.id} className="border-b last:border-b-0">
                <td className="px-2 py-1.5 text-muted-foreground">{attr.phase}</td>
                <td className="px-2 py-1.5">{attr.step_name}</td>
                <td className="px-2 py-1.5 font-medium">{modelDisplayName(attr.model_used)}</td>
                <td className="px-2 py-1.5 text-muted-foreground">{formatDate(attr.recorded_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { Bot } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useArtifactAttribution } from "@/hooks/use-model-attributions";

// --- Helpers ---

function modelDisplayName(modelId: string): string {
  if (modelId.includes("haiku")) return "Claude Haiku 4.5";
  if (modelId.includes("sonnet")) return "Claude Sonnet 4.6";
  if (modelId.includes("opus")) return "Claude Opus 4.6";
  return modelId;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Component ---

interface ArtifactAttributionBadgeProps {
  projectSlug: string;
  artifactId: string;
}

export function ArtifactAttributionBadge({
  projectSlug,
  artifactId,
}: ArtifactAttributionBadgeProps) {
  const { data: attribution } = useArtifactAttribution(projectSlug, artifactId);

  if (!attribution) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
          <Bot className="size-2.5" />
          Gerado por {modelDisplayName(attribution.model_used)}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          Fase: {attribution.phase} | Step: {attribution.step_name} |{" "}
          {formatDateTime(attribution.recorded_at)}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

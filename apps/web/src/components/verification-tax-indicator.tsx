import { Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useProductivitySnapshot } from "@/hooks/use-productivity-snapshot";
import { cn } from "@/lib/utils";

function formatMinutes(hours: number): string {
  const mins = Math.round(hours * 60);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function getSeverityConfig(ratio: number): {
  colorClass: string;
  tooltip: string;
} {
  if (ratio < 0.5) {
    return {
      colorClass: "text-green-600 dark:text-green-400",
      tooltip: "Verificacao eficiente. Tempo de revisao e baixo.",
    };
  }
  if (ratio < 1.0) {
    return {
      colorClass: "text-yellow-600 dark:text-yellow-400",
      tooltip:
        "Verification tax moderado. Revisao se aproxima do tempo de geracao.",
    };
  }
  return {
    colorClass: "text-red-600 dark:text-red-400",
    tooltip:
      "Verification tax alto! Revisao excede geracao. Considere simplificar o processo de revisao.",
  };
}

interface VerificationTaxIndicatorProps {
  projectId: string;
}

export function VerificationTaxIndicator({
  projectId,
}: VerificationTaxIndicatorProps) {
  const { data: snapshot } = useProductivitySnapshot(projectId, 30);

  if (
    !snapshot ||
    (snapshot.total_generation_hours === 0 &&
      snapshot.total_review_hours === 0)
  ) {
    return null;
  }

  const ratio = snapshot.verification_tax_ratio;
  const config = getSeverityConfig(ratio);

  return (
    <div className="border-t border-border/50 bg-muted/20 px-4 py-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex w-fit cursor-default items-center gap-2 text-xs",
              config.colorClass
            )}
          >
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              Review: {formatMinutes(snapshot.total_review_hours)}
              <span className="mx-1 text-muted-foreground">|</span>
              Geracao: {formatMinutes(snapshot.total_generation_hours)}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">{config.tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

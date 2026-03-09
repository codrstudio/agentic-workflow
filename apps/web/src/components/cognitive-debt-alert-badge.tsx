import { Link } from "@tanstack/react-router";
import { Brain, AlertTriangle } from "lucide-react";
import { useCognitiveDebtIndicators } from "@/hooks/use-cognitive-debt";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CognitiveDebtAlertBadgeProps {
  projectId: string;
}

export function CognitiveDebtAlertBadge({
  projectId,
}: CognitiveDebtAlertBadgeProps) {
  const { data: indicators } = useCognitiveDebtIndicators(projectId);

  if (!indicators) return null;

  const { comprehension_gap_ratio: gap, avg_cognitive_load: load } = indicators;
  const loadVal = load ?? 0;

  // Only show badge when alert condition is met
  const isYellow = gap > 5 || loadVal > 3.5;
  const isRed = gap > 7 || loadVal > 4.5;

  if (!isYellow) return null;

  const colorClass = isRed
    ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700"
    : "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";

  const tooltipLines = [
    `Gap geracao/revisao: ${gap.toFixed(1)}x`,
    load !== null ? `Cognitive load medio: ${load.toFixed(1)}/5` : null,
    `Gates totais: ${indicators.total_gates}`,
    `Completados: ${indicators.completed_gates} · Bypassed: ${indicators.bypassed_gates}`,
    indicators.high_risk_phases.length > 0
      ? `Fases criticas: ${indicators.high_risk_phases.join(", ")}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          to="/projects/$projectId/metrics/cognitive-debt"
          params={{ projectId }}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
            colorClass,
          )}
          data-testid="cognitive-debt-alert-badge"
        >
          {isRed ? (
            <AlertTriangle className="h-3 w-3" />
          ) : (
            <Brain className="h-3 w-3" />
          )}
          <span>Gap {gap.toFixed(1)}x</span>
          {load !== null && (
            <>
              <span className="opacity-50">·</span>
              <span>Load {load.toFixed(1)}</span>
            </>
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px]">
        <div className="flex flex-col gap-1">
          {tooltipLines.map((line) => (
            <p key={line} className="text-xs">
              {line}
            </p>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

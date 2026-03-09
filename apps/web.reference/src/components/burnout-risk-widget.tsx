import { useState } from "react";
import { Heart, Activity, ChevronDown, ChevronUp, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import {
  useBurnoutIndicators,
  type RiskLevel,
  type RiskFactor,
} from "@/hooks/use-burnout-indicators";
import { cn } from "@/lib/utils";

const RISK_CONFIG: Record<
  RiskLevel,
  { label: string; color: string; badgeClass: string; icon: typeof Heart }
> = {
  low: {
    label: "Baixo",
    color: "text-green-600 dark:text-green-400",
    badgeClass: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
    icon: Heart,
  },
  moderate: {
    label: "Moderado",
    color: "text-yellow-600 dark:text-yellow-400",
    badgeClass: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    icon: Activity,
  },
  high: {
    label: "Alto",
    color: "text-orange-600 dark:text-orange-400",
    badgeClass: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
    icon: Activity,
  },
  critical: {
    label: "Critico",
    color: "text-red-600 dark:text-red-400",
    badgeClass: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
    icon: Activity,
  },
};

interface BurnoutRiskWidgetProps {
  projectId: string;
}

export function BurnoutRiskWidget({ projectId }: BurnoutRiskWidgetProps) {
  const { data: indicators, isLoading } = useBurnoutIndicators(projectId);
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="h-[72px] animate-pulse rounded-lg border bg-muted" />
    );
  }

  if (!indicators) return null;

  const config = RISK_CONFIG[indicators.risk_level];
  const Icon = config.icon;
  const triggeredFactors = indicators.risk_factors.filter((f) => f.triggered);

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <div className={cn("rounded-md p-2", config.badgeClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            Risco de Burnout
          </p>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold",
                config.badgeClass
              )}
            >
              {config.label}
            </span>
            {triggeredFactors.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {triggeredFactors.length} fator{triggeredFactors.length !== 1 ? "es" : ""}
              </span>
            )}
          </div>
        </div>
        {triggeredFactors.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
            aria-label={expanded ? "Recolher fatores" : "Expandir fatores"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {expanded && triggeredFactors.length > 0 && (
        <div className="border-t px-3 py-2 space-y-1">
          {triggeredFactors.map((factor) => (
            <RiskFactorRow key={factor.factor} factor={factor} />
          ))}
        </div>
      )}

      <div className="border-t px-3 py-2">
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/projects/$projectId/metrics",
              params: { projectId },
              search: { tab: "wellbeing" },
            })
          }
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver dashboard
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function RiskFactorRow({ factor }: { factor: RiskFactor }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{factor.description}</span>
      <span className="tabular-nums font-medium text-orange-600 dark:text-orange-400">
        {factor.current_value}/{factor.threshold}
      </span>
    </div>
  );
}

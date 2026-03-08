import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SourceDensityMetrics, DensityFreshness } from "@/hooks/use-context-density";

// ---- Helpers ----

function densityColor(score: number): string {
  if (score > 70) return "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30";
  if (score >= 40) return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30";
  return "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30";
}

function freshnessLabel(f: DensityFreshness): string {
  if (f === "current") return "Current";
  if (f === "stale") return "Stale";
  return "Outdated";
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ---- Props ----

interface SourceDensityBadgeProps {
  metrics: SourceDensityMetrics;
  className?: string;
}

export function SourceDensityBadge({ metrics, className }: SourceDensityBadgeProps) {
  const score = Math.round(metrics.information_density);
  const hasRecommendation = metrics.recommendations.length > 0;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none cursor-default select-none",
              densityColor(score),
              className
            )}
          >
            {score}
            {hasRecommendation && (
              <Lightbulb className="h-2.5 w-2.5 opacity-80" />
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs">
          <div className="flex flex-col gap-1">
            <div className="font-semibold">Density Score: {score}/100</div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Tokens</span>
              <span>{formatTokens(metrics.token_count)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Relevance</span>
              <span>{Math.round(metrics.relevance_score)}/100</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Redundancy</span>
              <span>{Math.round(metrics.redundancy_score)}/100</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Freshness</span>
              <span>{freshnessLabel(metrics.freshness)}</span>
            </div>
            {hasRecommendation && (
              <div className="mt-1 border-t pt-1 flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Lightbulb className="h-3 w-3 shrink-0" />
                <span>{metrics.recommendations[0]!.reason}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

import { Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { useThroughputMetrics } from "@/hooks/use-throughput";
import { cn } from "@/lib/utils";

function firstPassColor(rate: number): string {
  if (rate >= 0.7) return "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700";
  if (rate >= 0.5) return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";
  return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
}

function formatHours(h: number | null): string {
  if (h === null || h === undefined) return "—";
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function formatPct(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

interface ProjectThroughputBadgeProps {
  projectId: string;
}

export function ProjectThroughputBadge({ projectId }: ProjectThroughputBadgeProps) {
  const { data: metrics } = useThroughputMetrics(projectId, 30);

  if (!metrics) return null;

  const { feature_level } = metrics;
  const colorClass = firstPassColor(feature_level.first_pass_rate);

  return (
    <Link
      to="/projects/$projectId/throughput"
      params={{ projectId }}
      title="Throughput Dashboard"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80",
        colorClass
      )}
      data-testid="project-throughput-badge"
    >
      <span className="flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {feature_level.completed}
      </span>
      <span className="opacity-50">·</span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {formatHours(feature_level.avg_cycle_time_hours)}
      </span>
      <span className="opacity-50">·</span>
      <span className="flex items-center gap-1">
        <TrendingUp className="h-3 w-3" />
        {formatPct(feature_level.first_pass_rate)}
      </span>
    </Link>
  );
}

import {
  Activity,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
  Clock,
  ChevronRight,
  SkipForward,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StepInfo } from "@/hooks/use-harness";

export function StepStatusIcon({ status }: { status: StepInfo["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />;
    case "failed":
      return <XCircle className="h-5 w-5 text-red-500 shrink-0" />;
    case "running":
      return (
        <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
          <Loader2 className="relative h-5 w-5 text-blue-500 animate-spin" />
        </span>
      );
    case "skipped":
      return <SkipForward className="h-5 w-5 text-yellow-500 shrink-0" />;
    case "pending":
    default:
      return <Circle className="h-5 w-5 text-muted-foreground shrink-0" />;
  }
}

export function StepTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    "spawn-agent":
      "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
    "spawn-agent-call":
      "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
    "ralph-wiggum-loop":
      "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "chain-workflow":
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  };

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] px-1.5 py-0", colors[type] ?? "")}
    >
      {type}
    </Badge>
  );
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

export function StepTimeline({
  steps,
  selectedStep,
  onSelectStep,
}: {
  steps: StepInfo[];
  selectedStep: StepInfo | null;
  onSelectStep: (step: StepInfo) => void;
}) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Activity className="h-8 w-8 opacity-30 mb-2" />
        <p className="text-sm">No steps in this wave</p>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col">
      {/* Vertical connector line */}
      {steps.length > 1 && (
        <div
          className="absolute left-[9px] top-[10px] w-0.5 bg-border"
          style={{ height: `calc(100% - 20px)` }}
        />
      )}

      {steps.map((step) => (
        <div key={step.number} className="relative flex gap-3 pb-2">
          {/* Status icon (on top of the connector line) */}
          <div className="relative z-10 flex items-start pt-3">
            <div className="bg-background rounded-full">
              <StepStatusIcon status={step.status} />
            </div>
          </div>

          {/* Step card */}
          <button
            onClick={() => onSelectStep(step)}
            className={cn(
              "flex-1 flex items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors",
              "hover:border-primary/40 hover:bg-accent/50",
              selectedStep?.number === step.number &&
                "border-primary bg-accent",
              step.status === "running" && "border-blue-500/40",
              step.status === "failed" && "border-red-500/30"
            )}
          >
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-medium text-sm truncate">
                Step {step.number}: {step.name}
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <StepTypeBadge type={step.type} />
                {step.duration_ms != null && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(step.duration_ms)}
                  </span>
                )}
                {step.status === "running" && (
                  <span className="text-xs text-blue-500 font-medium">
                    In progress...
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 md:hidden" />
          </button>
        </div>
      ))}
    </div>
  );
}

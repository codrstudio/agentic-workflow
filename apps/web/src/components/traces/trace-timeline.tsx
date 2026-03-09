import { ScrollArea } from "@/components/ui/scroll-area";
import { TraceStepItem } from "./trace-step-item";
import type { TraceStep } from "@/api/traces";

interface TraceTimelineProps {
  steps: TraceStep[];
  totalDurationMs: number;
}

export function TraceTimeline({ steps, totalDurationMs }: TraceTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">Nenhum step registrado</p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="px-1 py-2">
        {steps.map((step) => (
          <TraceStepItem
            key={step.index}
            step={step}
            totalDurationMs={totalDurationMs}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

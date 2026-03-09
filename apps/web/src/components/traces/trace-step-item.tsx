import { useState } from "react";
import {
  MessageSquare,
  Wrench,
  CheckCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TraceStep } from "@/api/traces";

const stepConfig = {
  text: {
    icon: MessageSquare,
    label: "Texto",
    className: "text-blue-600 dark:text-blue-400",
  },
  tool_call: {
    icon: Wrench,
    label: "Tool Call",
    className: "text-amber-600 dark:text-amber-400",
  },
  tool_result: {
    icon: CheckCircle,
    label: "Resultado",
    className: "text-green-600 dark:text-green-400",
  },
} as const;

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatJson(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

interface TraceStepItemProps {
  step: TraceStep;
  totalDurationMs: number;
}

export function TraceStepItem({ step, totalDurationMs }: TraceStepItemProps) {
  const [expanded, setExpanded] = useState(false);
  const config = stepConfig[step.type];
  const Icon = config.icon;
  const durationPct =
    totalDurationMs > 0
      ? Math.max(2, (step.durationMs / totalDurationMs) * 100)
      : 0;

  const hasExpandableContent =
    step.content || step.toolInput != null || step.toolOutput != null;

  return (
    <div className="relative flex gap-3 pb-4 last:pb-0">
      {/* Vertical line connector */}
      <div className="flex flex-col items-center">
        <div
          className={`flex size-7 shrink-0 items-center justify-center rounded-full border bg-background ${config.className}`}
        >
          <Icon className="size-3.5" />
        </div>
        <div className="w-px flex-1 bg-border" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => hasExpandableContent && setExpanded(!expanded)}
          disabled={!hasExpandableContent}
        >
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
          {step.toolName && (
            <code className="text-xs text-muted-foreground">
              {step.toolName}
            </code>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDuration(step.durationMs)}
          </span>
          {step.tokensIn != null && step.tokensOut != null && (
            <span className="text-xs text-muted-foreground">
              {step.tokensIn + step.tokensOut}t
            </span>
          )}
          {hasExpandableContent && (
            <span className="text-muted-foreground">
              {expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </span>
          )}
        </button>

        {/* Duration bar */}
        <div className="h-1.5 w-full rounded-full bg-muted">
          <div
            className={`h-full rounded-full bg-current opacity-30 ${config.className}`}
            style={{ width: `${durationPct}%` }}
          />
        </div>

        {/* Expandable content */}
        {expanded && (
          <div className="space-y-2 pt-1">
            {step.content && (
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs">
                {step.content}
              </pre>
            )}
            {step.toolInput != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Input
                </p>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs">
                  {formatJson(step.toolInput)}
                </pre>
              </div>
            )}
            {step.toolOutput != null && (
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Output
                </p>
                <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs">
                  {formatJson(step.toolOutput)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

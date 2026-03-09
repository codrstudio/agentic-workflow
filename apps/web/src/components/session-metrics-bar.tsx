import { useState, useMemo } from "react";
import { Zap, Clock, DollarSign, ChevronUp, ChevronDown } from "lucide-react";

export interface SessionMetricsData {
  tokens: number;
  input_tokens?: number;
  output_tokens?: number;
  cost_usd: number;
  duration_ms: number | null;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US");
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null || ms <= 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function SessionMetricsBar({ metrics }: { metrics: SessionMetricsData }) {
  const [expanded, setExpanded] = useState(false);

  const inputTokens = metrics.input_tokens ?? 0;
  const outputTokens = metrics.output_tokens ?? 0;
  const hasBreakdown = inputTokens > 0 || outputTokens > 0;

  const costBreakdown = useMemo(() => {
    if (!hasBreakdown || metrics.tokens === 0) return null;
    const inputRatio = inputTokens / metrics.tokens;
    const outputRatio = outputTokens / metrics.tokens;
    return {
      input_cost: metrics.cost_usd * inputRatio,
      output_cost: metrics.cost_usd * outputRatio,
    };
  }, [inputTokens, outputTokens, metrics.tokens, metrics.cost_usd, hasBreakdown]);

  return (
    <div className="border-t bg-muted/30">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-4 py-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-blue-500" />
            {formatTokens(metrics.tokens)} tokens
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {formatDuration(metrics.duration_ms)}
          </span>
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3 text-green-500" />
            {formatCost(metrics.cost_usd)}
          </span>
        </div>
        {hasBreakdown && (
          expanded
            ? <ChevronDown className="h-3 w-3" />
            : <ChevronUp className="h-3 w-3" />
        )}
      </button>

      {expanded && hasBreakdown && (
        <div className="border-t border-border/50 px-4 py-2 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1">
            <div className="flex justify-between">
              <span>Input tokens</span>
              <span className="font-mono">{inputTokens.toLocaleString("en-US")}</span>
            </div>
            <div className="flex justify-between">
              <span>Output tokens</span>
              <span className="font-mono">{outputTokens.toLocaleString("en-US")}</span>
            </div>
            {costBreakdown && (
              <>
                <div className="flex justify-between">
                  <span>Input cost</span>
                  <span className="font-mono">{formatCost(costBreakdown.input_cost)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Output cost</span>
                  <span className="font-mono">{formatCost(costBreakdown.output_cost)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

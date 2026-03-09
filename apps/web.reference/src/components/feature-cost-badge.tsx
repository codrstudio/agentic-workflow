import { useState } from "react";
import { ChevronDown, ChevronRight, Cpu } from "lucide-react";
import { useFeatureCost, type TokenUsageRecord } from "@/hooks/use-cost-metrics";
import { formatTokens, formatDate } from "@/components/metrics-table";

function formatCostCompact(n: number): string {
  return `$${n.toFixed(2)}`;
}

function modelLabel(model: string): string {
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  return model;
}

// --- Inline badge for FeatureCard (compact) ---

interface FeatureCostBadgeInlineProps {
  totalCost: number;
  totalTokens: number;
}

export function FeatureCostBadgeInline({
  totalCost,
  totalTokens,
}: FeatureCostBadgeInlineProps) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
      <Cpu className="size-2.5" />
      AI: {formatCostCompact(totalCost)} | {formatTokens(totalTokens)} tokens
    </span>
  );
}

// --- Expandable badge for FeatureDetailPanel ---

interface FeatureCostBadgeProps {
  projectSlug: string;
  featureId: string;
}

export function FeatureCostBadge({
  projectSlug,
  featureId,
}: FeatureCostBadgeProps) {
  const { data } = useFeatureCost(projectSlug, featureId);
  const [expanded, setExpanded] = useState(false);

  if (!data || data.records.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {expanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <Cpu className="size-3.5" />
        <span>
          AI: {formatCostCompact(data.total_cost_usd)} |{" "}
          {formatTokens(data.total_tokens)} tokens
        </span>
        <span className="ml-auto text-[10px]">
          {data.records.length} spawn(s)
        </span>
      </button>

      {expanded && (
        <div className="mt-2 overflow-x-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Data
                </th>
                <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                  Modelo
                </th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">
                  Tokens
                </th>
                <th className="px-2 py-1.5 text-right font-medium text-muted-foreground">
                  Custo
                </th>
              </tr>
            </thead>
            <tbody>
              {data.records.map((r: TokenUsageRecord) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-2 py-1.5 text-muted-foreground">
                    {formatDate(r.recorded_at)}
                  </td>
                  <td className="px-2 py-1.5">{modelLabel(r.model)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {formatTokens(r.input_tokens + r.output_tokens)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-mono">
                    {formatCostCompact(r.cost_usd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

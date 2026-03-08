import { useState } from "react";
import { DollarSign } from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { usePhaseCost, type TokenUsageRecord } from "@/hooks/use-cost-metrics";
import { formatTokens, formatDate } from "@/components/metrics-table";

// --- Helpers ---

function formatCostCompact(n: number): string {
  return `$${n.toFixed(2)}`;
}

function dominantModel(records: TokenUsageRecord[]): string {
  const costByModel: Record<string, number> = {};
  for (const r of records) {
    costByModel[r.model] = (costByModel[r.model] ?? 0) + r.cost_usd;
  }
  let best = "—";
  let max = 0;
  for (const [model, cost] of Object.entries(costByModel)) {
    if (cost > max) {
      max = cost;
      best = model;
    }
  }
  return best;
}

function totalInputTokens(records: TokenUsageRecord[]): number {
  return records.reduce((s, r) => s + r.input_tokens, 0);
}

function totalOutputTokens(records: TokenUsageRecord[]): number {
  return records.reduce((s, r) => s + r.output_tokens, 0);
}

function totalCost(records: TokenUsageRecord[]): number {
  return records.reduce((s, r) => s + r.cost_usd, 0);
}

function modelLabel(model: string): string {
  if (model.includes("haiku")) return "Haiku";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("opus")) return "Opus";
  return model;
}

// --- Component ---

interface CostPipelineBadgeProps {
  projectSlug: string;
  phase: string;
  phaseLabel: string;
}

export function CostPipelineBadge({
  projectSlug,
  phase,
  phaseLabel,
}: CostPipelineBadgeProps) {
  const { data: records } = usePhaseCost(projectSlug, phase);
  const [open, setOpen] = useState(false);

  if (!records || records.length === 0) return null;

  const cost = totalCost(records);
  const inputTok = totalInputTokens(records);
  const outputTok = totalOutputTokens(records);
  const model = dominantModel(records);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium text-muted-foreground hover:bg-muted-foreground/20 transition-colors cursor-pointer"
          >
            <DollarSign className="size-2.5" />
            {formatCostCompact(cost).slice(1)}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {modelLabel(model)} — {formatTokens(inputTok)} tokens input,{" "}
            {formatTokens(outputTok)} output
          </p>
        </TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custo da fase: {phaseLabel}</DialogTitle>
            <DialogDescription>
              Total: {formatCostCompact(cost)} | {formatTokens(inputTok + outputTok)} tokens |{" "}
              {records.length} registro(s)
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Data
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Modelo
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Input
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Output
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                    Custo
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDate(r.recorded_at)}
                    </td>
                    <td className="px-3 py-2 text-xs">{modelLabel(r.model)}</td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">
                      {formatTokens(r.input_tokens)}
                    </td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums">
                      {formatTokens(r.output_tokens)}
                    </td>
                    <td className="px-3 py-2 text-xs text-right tabular-nums font-mono">
                      {formatCostCompact(r.cost_usd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

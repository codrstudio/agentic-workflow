import { DollarSign, Phone, Coins } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CostSummary } from "@/api/costs";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function getCallsByOperation(byOperation: CostSummary["byOperation"]): string {
  const parts: string[] = [];
  for (const op of byOperation) {
    const label =
      op.operation === "heartbeat"
        ? "heartbeat"
        : op.operation === "conversation"
          ? "conversa"
          : op.operation;
    parts.push(`${label}: ${op.calls}`);
  }
  return parts.join(", ");
}

interface CostSummaryCardsProps {
  data: CostSummary;
}

export function CostSummaryCards({ data }: CostSummaryCardsProps) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(data.totalCostUsd)}</div>
          <p className="text-xs text-muted-foreground">no periodo selecionado</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total de Chamadas</CardTitle>
          <Phone className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.totalCalls.toLocaleString("pt-BR")}</div>
          <p className="text-xs text-muted-foreground">
            {getCallsByOperation(data.byOperation)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tokens Consumidos</CardTitle>
          <Coins className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatTokens(data.totalTokensIn + data.totalTokensOut)}
          </div>
          <p className="text-xs text-muted-foreground">
            entrada: {formatTokens(data.totalTokensIn)}, saida: {formatTokens(data.totalTokensOut)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

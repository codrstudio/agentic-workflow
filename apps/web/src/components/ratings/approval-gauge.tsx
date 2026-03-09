import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ApprovalGaugeProps {
  approvalRate: number;
  total: number;
  upCount: number;
  downCount: number;
}

function getColor(rate: number) {
  if (rate >= 0.8) return "text-green-600";
  if (rate >= 0.6) return "text-yellow-600";
  return "text-destructive";
}

function getStroke(rate: number) {
  if (rate >= 0.8) return "stroke-green-500";
  if (rate >= 0.6) return "stroke-yellow-500";
  return "stroke-destructive";
}

export function ApprovalGauge({ approvalRate, total, upCount, downCount }: ApprovalGaugeProps) {
  const pct = Math.round(approvalRate * 100);
  // SVG circle gauge: r=36, circumference ~226
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (approvalRate * circ).toFixed(1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Taxa de Aprovacao</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          <svg width={100} height={100} viewBox="0 0 100 100">
            <circle
              cx={50}
              cy={50}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeWidth={10}
              className="text-muted"
            />
            <circle
              cx={50}
              cy={50}
              r={r}
              fill="none"
              strokeWidth={10}
              strokeDasharray={`${dash} ${circ}`}
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              className={cn(getStroke(approvalRate))}
            />
          </svg>
          <span className={cn("absolute text-xl font-bold", getColor(approvalRate))}>
            {pct}%
          </span>
        </div>
        <div className="flex gap-6 text-sm">
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-green-600">{upCount}</span>
            <span className="text-xs text-muted-foreground">Positivos</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-muted-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-lg font-semibold text-destructive">{downCount}</span>
            <span className="text-xs text-muted-foreground">Negativos</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

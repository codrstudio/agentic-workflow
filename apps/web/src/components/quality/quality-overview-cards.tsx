import { ThumbsUp, ThumbsDown, Star, BarChart2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AgentQuality } from "@/api/quality";

interface QualityOverviewCardsProps {
  quality: AgentQuality;
}

export function QualityOverviewCards({ quality }: QualityOverviewCardsProps) {
  const { totalRatings, upCount, downCount, approvalRate } = quality;
  const pct = Math.round(approvalRate * 100);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-primary/10 p-2">
              <Star className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pct}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Aprovacao</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-muted p-2">
              <BarChart2 className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalRatings}</p>
              <p className="text-xs text-muted-foreground">Total de Avaliacoes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-green-500/10 p-2">
              <ThumbsUp className="size-4 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{upCount}</p>
              <p className="text-xs text-muted-foreground">Avaliacoes Positivas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-destructive/10 p-2">
              <ThumbsDown className="size-4 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{downCount}</p>
              <p className="text-xs text-muted-foreground">Avaliacoes Negativas</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

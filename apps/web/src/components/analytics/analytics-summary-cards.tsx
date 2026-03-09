import { ArrowDown, ArrowUp, Heart, MessageSquare, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalyticsOverview } from "@/api/analytics";

interface DeltaIndicatorProps {
  delta: number;
  suffix?: string;
  inverted?: boolean;
}

function DeltaIndicator({ delta, suffix = "", inverted = false }: DeltaIndicatorProps) {
  if (delta === 0) return <span className="text-xs text-muted-foreground">sem variacao</span>;

  const isPositive = delta > 0;
  const isGood = inverted ? !isPositive : isPositive;

  const Icon = isPositive ? ArrowUp : ArrowDown;
  const colorClass = isGood ? "text-green-600" : "text-red-600";

  const formatted = isPositive ? `+${formatDelta(delta)}${suffix}` : `${formatDelta(delta)}${suffix}`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {formatted}
    </span>
  );
}

function formatDelta(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

function formatMs(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

interface AnalyticsSummaryCardsProps {
  data: AnalyticsOverview;
}

export function AnalyticsSummaryCards({ data }: AnalyticsSummaryCardsProps) {
  const combinedErrorRate =
    (data.heartbeats.total + data.cron.total) > 0
      ? (data.heartbeats.error + data.cron.error) / (data.heartbeats.total + data.cron.total)
      : 0;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* Heartbeats */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Heartbeats</CardTitle>
          <Heart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.heartbeats.ok} ok</div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-muted-foreground">
              {formatPercent(data.heartbeats.errorRate)} erro
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Conversas */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Conversas</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.conversations.total}</div>
          <div className="flex items-center gap-2 mt-1">
            <DeltaIndicator delta={data.comparison.conversationsDelta} />
            <p className="text-xs text-muted-foreground">
              {data.conversations.messagesIn + data.conversations.messagesOut} msgs
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Taxa de Erro */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Taxa de Erro</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercent(combinedErrorRate)}</div>
          <div className="flex items-center gap-2 mt-1">
            <DeltaIndicator
              delta={data.comparison.heartbeatErrorRateDelta * 100}
              suffix="pp"
              inverted
            />
            <p className="text-xs text-muted-foreground">heartbeat + cron</p>
          </div>
        </CardContent>
      </Card>

      {/* Tempo de Resposta */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatMs(data.avgResponseMs)}</div>
          <div className="flex items-center gap-2 mt-1">
            <DeltaIndicator
              delta={data.comparison.avgResponseMsDelta}
              suffix="ms"
              inverted
            />
            <p className="text-xs text-muted-foreground">media do periodo</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

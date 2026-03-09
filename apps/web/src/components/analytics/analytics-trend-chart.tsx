import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { analyticsTrendQueryOptions } from "@/api/analytics";

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

const heartbeatsConfig = {
  ok: { label: "OK", color: "var(--color-chart-2)" },
  error: { label: "Erro", color: "var(--color-chart-5)" },
  skipped: { label: "Ignorado", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

const conversationsConfig = {
  total: { label: "Conversas", color: "var(--color-chart-1)" },
  messagesIn: { label: "Msgs Recebidas", color: "var(--color-chart-2)" },
  messagesOut: { label: "Msgs Enviadas", color: "var(--color-chart-3)" },
} satisfies ChartConfig;

const errorsConfig = {
  heartbeatErrors: { label: "Heartbeat", color: "var(--color-chart-5)" },
  cronErrors: { label: "Cron", color: "var(--color-chart-4)" },
} satisfies ChartConfig;

const responseTimeConfig = {
  avgMs: { label: "Tempo Medio (ms)", color: "var(--color-chart-1)" },
} satisfies ChartConfig;

const METRICS = [
  { value: "heartbeats", label: "Heartbeats" },
  { value: "conversations", label: "Conversas" },
  { value: "errors", label: "Erros" },
  { value: "response_time", label: "Tempo de Resposta" },
] as const;

type MetricKey = (typeof METRICS)[number]["value"];

interface AnalyticsTrendChartProps {
  from: string;
  to: string;
  agentId?: string;
}

export function AnalyticsTrendChart({ from, to, agentId }: AnalyticsTrendChartProps) {
  const [metric, setMetric] = useState<MetricKey>("heartbeats");

  const { data, isLoading } = useQuery(
    analyticsTrendQueryOptions({ from, to, metric, agentId }),
  );

  const points = data?.points ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tendencia</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
          <div className="overflow-x-auto -mx-1 px-1">
            <TabsList className="mb-4">
              {METRICS.map((m) => (
                <TabsTrigger key={m.value} value={m.value}>
                  {m.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {isLoading ? (
            <Skeleton className="h-[250px] w-full rounded-lg" />
          ) : (
            <>
              <TabsContent value="heartbeats">
                <HeartbeatsChart data={points} />
              </TabsContent>
              <TabsContent value="conversations">
                <ConversationsChart data={points} />
              </TabsContent>
              <TabsContent value="errors">
                <ErrorsChart data={points} />
              </TabsContent>
              <TabsContent value="response_time">
                <ResponseTimeChart data={points} />
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

function HeartbeatsChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartContainer config={heartbeatsConfig} className="aspect-auto h-[250px] w-full">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fillOk" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-ok)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-ok)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="fillError" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-error)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-error)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="fillSkipped" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-skipped)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-skipped)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatDate} />
        <YAxis tickLine={false} axisLine={false} tickMargin={4} width={40} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => formatDate(String(v))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area type="monotone" dataKey="ok" stackId="1" stroke="var(--color-ok)" fill="url(#fillOk)" strokeWidth={2} />
        <Area type="monotone" dataKey="error" stackId="1" stroke="var(--color-error)" fill="url(#fillError)" strokeWidth={2} />
        <Area type="monotone" dataKey="skipped" stackId="1" stroke="var(--color-skipped)" fill="url(#fillSkipped)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}

function ConversationsChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartContainer config={conversationsConfig} className="aspect-auto h-[250px] w-full">
      <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatDate} />
        <YAxis tickLine={false} axisLine={false} tickMargin={4} width={40} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => formatDate(String(v))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Line type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="messagesIn" stroke="var(--color-messagesIn)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        <Line type="monotone" dataKey="messagesOut" stroke="var(--color-messagesOut)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ChartContainer>
  );
}

function ErrorsChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartContainer config={errorsConfig} className="aspect-auto h-[250px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatDate} />
        <YAxis tickLine={false} axisLine={false} tickMargin={4} width={40} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => formatDate(String(v))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="heartbeatErrors" fill="var(--color-heartbeatErrors)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="cronErrors" fill="var(--color-cronErrors)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

function ResponseTimeChart({ data }: { data: Record<string, unknown>[] }) {
  return (
    <ChartContainer config={responseTimeConfig} className="aspect-auto h-[250px] w-full">
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fillAvgMs" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-avgMs)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--color-avgMs)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatDate} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          width={50}
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(v) => formatDate(String(v))}
              formatter={(value) => {
                const ms = Number(value);
                return [ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`, "Tempo Medio"];
              }}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="avgMs"
          stroke="var(--color-avgMs)"
          fill="url(#fillAvgMs)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

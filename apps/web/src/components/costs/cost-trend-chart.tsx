import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CostTrendPoint } from "@/api/costs";

const chartConfig = {
  costUsd: {
    label: "Custo (USD)",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig;

function formatDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

interface CostTrendChartProps {
  data: CostTrendPoint[];
}

export function CostTrendChart({ data }: CostTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Tendencia de Custos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="fillCost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-costUsd)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--color-costUsd)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={formatDate}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              width={60}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v) => formatDate(String(v))}
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, "Custo"]}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="costUsd"
              stroke="var(--color-costUsd)"
              fill="url(#fillCost)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

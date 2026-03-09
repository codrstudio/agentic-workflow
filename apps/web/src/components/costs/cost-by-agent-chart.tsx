import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CostSummary } from "@/api/costs";

const chartConfig = {
  costUsd: {
    label: "Custo (USD)",
    color: "var(--color-chart-2)",
  },
} satisfies ChartConfig;

interface CostByAgentChartProps {
  data: CostSummary["byAgent"];
  agentNameMap: Record<string, string>;
}

export function CostByAgentChart({ data, agentNameMap }: CostByAgentChartProps) {
  const chartData = data.map((item) => ({
    agent: agentNameMap[item.agentId] || item.agentId,
    costUsd: item.costUsd,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Custo por Agente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <YAxis
              dataKey="agent"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={100}
            />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, "Custo"]}
                />
              }
            />
            <Bar
              dataKey="costUsd"
              fill="var(--color-costUsd)"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

import { Cell, Label, Pie, PieChart } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { CostSummary } from "@/api/costs";

const OPERATION_LABELS: Record<string, string> = {
  heartbeat: "Heartbeat",
  conversation: "Conversa",
  cron: "Cron",
};

const OPERATION_COLORS = [
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

interface CostByOperationChartProps {
  data: CostSummary["byOperation"];
  totalCostUsd: number;
}

export function CostByOperationChart({
  data,
  totalCostUsd,
}: CostByOperationChartProps) {
  const chartData = data.map((item, i) => ({
    operation: OPERATION_LABELS[item.operation] || item.operation,
    costUsd: item.costUsd,
    fill: OPERATION_COLORS[i % OPERATION_COLORS.length],
  }));

  const chartConfig = chartData.reduce<ChartConfig>((acc, item) => {
    acc[item.operation] = {
      label: item.operation,
      color: item.fill,
    };
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Custo por Operacao
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-square h-[250px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  nameKey="operation"
                  formatter={(value) => [`$${Number(value).toFixed(4)}`, ""]}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="costUsd"
              nameKey="operation"
              innerRadius={60}
              outerRadius={90}
              strokeWidth={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-xl font-bold"
                        >
                          ${totalCostUsd.toFixed(2)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-muted-foreground text-xs"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SecuritySummaryTrendPoint } from "@/api/security";

interface SecurityTrendChartProps {
  trend: SecuritySummaryTrendPoint[];
}

export function SecurityTrendChart({ trend }: SecurityTrendChartProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Tendencia de Eventos</CardTitle>
      </CardHeader>
      <CardContent>
        {trend.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Sem dados para o periodo selecionado.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip labelFormatter={(label) => `Data: ${String(label)}`} />
              <Legend
                formatter={(value: string) =>
                  value === "blocked" ? "Bloqueados" : "Suspeitos"
                }
              />
              <Bar dataKey="blocked" stackId="a" fill="hsl(var(--destructive))" />
              <Bar dataKey="flagged" stackId="a" fill="hsl(var(--warning, 45 93% 47%))" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

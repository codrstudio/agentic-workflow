import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TopReason } from "@/api/quality";

const REASON_LABELS: Record<string, string> = {
  resposta_incorreta: "Resposta incorreta",
  sem_contexto: "Sem contexto",
  incompleta: "Incompleta",
  tom_inadequado: "Tom inadequado",
  outro: "Outro",
};

interface TopReasonsChartProps {
  reasons: TopReason[];
}

export function TopReasonsChart({ reasons }: TopReasonsChartProps) {
  const data = reasons.map((r) => ({
    reason: REASON_LABELS[r.reason] ?? r.reason,
    count: r.count,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Principais Motivos de Reprovacao
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Nenhuma reprovacao com motivo no periodo.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, data.length * 40)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="reason" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v) => [v, "Ocorrencias"]} />
              <Bar dataKey="count" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

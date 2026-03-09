import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const CATEGORY_LABELS: Record<string, string> = {
  wrong_info: "Info incorreta",
  off_topic: "Fora do topico",
  too_long: "Muito longa",
  rude: "Tom inadequado",
  other: "Outro",
};

const COLORS = ["#ef4444", "#f97316", "#eab308", "#8b5cf6", "#6b7280"];

interface RatingsCategoryChartProps {
  byCategory: Record<string, number>;
}

export function RatingsCategoryChart({ byCategory }: RatingsCategoryChartProps) {
  const data = Object.entries(byCategory).map(([key, value]) => ({
    name: CATEGORY_LABELS[key] ?? key,
    value,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Categorias de Falha</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma avaliacao negativa com categoria no periodo.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [value, name]} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

import { useMemo } from "react";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import {
  useProductivitySnapshot,
  useProductivityHistory,
} from "@/hooks/use-productivity-snapshot";
import { cn } from "@/lib/utils";

function formatRoi(h: number): string {
  const abs = Math.abs(h);
  if (abs < 1) return `${Math.round(abs * 60)}min`;
  return `${abs.toFixed(1)}h`;
}

interface ROISummaryWidgetProps {
  projectId: string;
}

export function ROISummaryWidget({ projectId }: ROISummaryWidgetProps) {
  const navigate = useNavigate();

  const { from, to } = useMemo(() => {
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 28);
    return {
      from: fromDate.toISOString().slice(0, 10),
      to: toDate.toISOString().slice(0, 10),
    };
  }, []);

  const { data: snapshot, isLoading } = useProductivitySnapshot(projectId, 30);
  const { data: historyData } = useProductivityHistory(projectId, from, to);

  const sparklineData = useMemo(() => {
    const entries = historyData?.history ?? [];
    return entries.slice(-4).map((e) => ({ roi: e.snapshot.net_roi_hours }));
  }, [historyData]);

  if (isLoading) {
    return <div className="h-[72px] animate-pulse rounded-lg border bg-muted" />;
  }

  if (!snapshot) return null;

  const positive = snapshot.net_roi_hours >= 0;

  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex items-center gap-3 p-3">
        <div
          className={cn(
            "rounded-md p-2",
            positive
              ? "bg-green-500/10 text-green-600 dark:text-green-400"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}
        >
          {positive ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            ROI AI — ultimos 30 dias
          </p>
          <span
            className={cn(
              "text-lg font-bold",
              positive
                ? "text-green-700 dark:text-green-400"
                : "text-red-700 dark:text-red-400"
            )}
          >
            {positive ? "+" : "-"}
            {formatRoi(snapshot.net_roi_hours)}
          </span>
        </div>

        {/* Mini sparkline — last 4 weekly snapshots */}
        {sparklineData.length >= 2 && (
          <div className="w-16 shrink-0">
            <ResponsiveContainer width="100%" height={32}>
              <LineChart
                data={sparklineData}
                margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
              >
                <Line
                  type="monotone"
                  dataKey="roi"
                  stroke={positive ? "#22c55e" : "#ef4444"}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="border-t px-3 py-2">
        <button
          type="button"
          onClick={() =>
            navigate({
              to: "/projects/$projectId/metrics",
              params: { projectId },
              search: { tab: "produtividade-ai" },
            })
          }
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Ver detalhes
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

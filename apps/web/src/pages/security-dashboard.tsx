import { type ElementType } from "react";
import { useParams } from "@tanstack/react-router";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Activity,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSecurityScorecard, type SecurityFinding } from "@/hooks/use-security";
import { cn } from "@/lib/utils";

// --- Scorecard badge ---

function scorecardColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800 border-green-300";
  if (score >= 60) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
}

function scorecardLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  return "At Risk";
}

function Scorecard({ score }: { score: number }) {
  return (
    <div
      className={cn(
        "inline-flex flex-col items-center justify-center rounded-2xl border-2 px-8 py-4 min-w-[120px]",
        scorecardColor(score)
      )}
      data-testid="scorecard-badge"
    >
      <span className="text-4xl font-bold leading-none">{score}</span>
      <span className="text-xs font-medium mt-1 uppercase tracking-wide">
        {scorecardLabel(score)}
      </span>
    </div>
  );
}

// --- KPI Card ---

function KpiCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: string | number;
  icon: ElementType;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="size-4" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// --- Severity badge ---

const SEV_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300",
  low: "bg-blue-100 text-blue-800 border-blue-300",
  info: "bg-gray-100 text-gray-700 border-gray-300",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <Badge
      variant="outline"
      className={cn("text-xs capitalize", SEV_COLORS[severity] ?? SEV_COLORS.info)}
    >
      {severity}
    </Badge>
  );
}

// --- Critical Findings List ---

function CriticalFindingRow({ finding }: { finding: SecurityFinding }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <SeverityBadge severity={finding.severity} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{finding.title}</p>
        <p className="text-xs text-muted-foreground">
          {finding.category}
          {finding.feature_id && ` · ${finding.feature_id}`}
          {finding.file_path && ` · ${finding.file_path}${finding.line_number ? `:${finding.line_number}` : ""}`}
        </p>
      </div>
    </div>
  );
}

// --- Chart colors ---

const CHART_COLORS = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#9ca3af",
};

// --- Main Page ---

export function SecurityDashboardPage() {
  const { projectId } = useParams({ strict: false }) as { projectId: string };
  const { data: scorecard, isLoading } = useSecurityScorecard(projectId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-24 w-28 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!scorecard) {
    return (
      <div className="p-6 text-muted-foreground">Failed to load security scorecard.</div>
    );
  }

  const avgResLabel =
    scorecard.avg_resolution_hours != null
      ? `${scorecard.avg_resolution_hours}h`
      : "—";

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-6">
        <Scorecard score={scorecard.score} />
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="size-5" />
            Security Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Security posture overview for this project
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Security Score"
          value={scorecard.score}
          icon={Shield}
          sub={scorecardLabel(scorecard.score)}
        />
        <KpiCard
          label="Open Findings"
          value={scorecard.open_count}
          icon={Activity}
          sub="all severities"
        />
        <KpiCard
          label="Critical + High"
          value={scorecard.critical_high_count}
          icon={AlertTriangle}
          sub="open blockers"
        />
        <KpiCard
          label="Avg Resolution"
          value={avgResLabel}
          icon={Clock}
          sub="time to resolve"
        />
      </div>

      {/* Weekly Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Findings por Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={scorecard.weekly_findings}
              margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="critical" stackId="a" fill={CHART_COLORS.critical} name="Critical" />
              <Bar dataKey="high" stackId="a" fill={CHART_COLORS.high} name="High" />
              <Bar dataKey="medium" stackId="a" fill={CHART_COLORS.medium} name="Medium" />
              <Bar dataKey="low" stackId="a" fill={CHART_COLORS.low} name="Low" />
              <Bar dataKey="info" stackId="a" fill={CHART_COLORS.info} name="Info" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Critical + High Open Findings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-500" />
            Findings Críticos e Altos Abertos
            {scorecard.critical_high_count > 0 && (
              <Badge variant="destructive" className="ml-auto">
                {scorecard.critical_high_count}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {scorecard.open_critical_high.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-green-700 py-2">
              <CheckCircle2 className="size-4" />
              No critical or high open findings
            </div>
          ) : (
            <div>
              {scorecard.open_critical_high.map((f) => (
                <CriticalFindingRow key={f.id} finding={f} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

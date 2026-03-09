import { useState } from "react";
import {
  AlertTriangle,
  Shield,
  Eye,
  FileWarning,
  Users,
  FilePieChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import {
  useComplianceSnapshot,
  useCreateIpReport,
  type ComplianceSnapshot,
  type ShadowAiRisk,
  type IPAttributionReport,
} from "@/hooks/use-compliance";
import { IPAttributionReportView } from "@/components/ip-attribution-report";
import { DecisionTimeline, ComplianceExportDialog } from "@/components/decision-timeline";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: 7, label: "7 dias" },
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
] as const;

const RISK_CONFIG: Record<
  ShadowAiRisk,
  { label: string; className: string }
> = {
  low: {
    label: "Baixo",
    className:
      "bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20",
  },
  moderate: {
    label: "Moderado",
    className:
      "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20",
  },
  high: {
    label: "Alto",
    className:
      "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20",
  },
};

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

// ----------------------------------------------------------------
// Shadow AI Risk Badge
// ----------------------------------------------------------------

function ShadowRiskBadge({ risk }: { risk: ShadowAiRisk }) {
  const cfg = RISK_CONFIG[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.className
      )}
    >
      <Shield className="h-3 w-3" />
      Shadow AI Risk: {cfg.label}
    </span>
  );
}

// ----------------------------------------------------------------
// AI/Human Proportion Stacked Bar
// ----------------------------------------------------------------

function buildProportionData(snapshot: ComplianceSnapshot) {
  const { artifacts_by_origin } = snapshot;
  return [
    {
      name: "Período Atual",
      ai_generated: artifacts_by_origin.ai_generated,
      ai_assisted: artifacts_by_origin.ai_assisted,
      human_written: artifacts_by_origin.human_written,
      mixed: artifacts_by_origin.mixed,
    },
  ];
}

function ProportionStackedBar({ snapshot }: { snapshot: ComplianceSnapshot }) {
  const data = buildProportionData(snapshot);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="name" />
        <YAxis />
        <RechartsTooltip />
        <Legend />
        <Bar
          dataKey="ai_generated"
          name="AI Gerado"
          stackId="a"
          fill="#ef4444"
        />
        <Bar
          dataKey="ai_assisted"
          name="AI Assistido"
          stackId="a"
          fill="#f97316"
        />
        <Bar dataKey="mixed" name="Misto" stackId="a" fill="#a855f7" />
        <Bar
          dataKey="human_written"
          name="Humano"
          stackId="a"
          fill="#22c55e"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ----------------------------------------------------------------
// Shadow AI Risk Section
// ----------------------------------------------------------------

function ShadowAiRiskSection({
  snapshot,
  onStartReview,
}: {
  snapshot: ComplianceSnapshot;
  onStartReview?: () => void;
}) {
  const risk = snapshot.shadow_ai_risk;
  const cfg = RISK_CONFIG[risk];
  const count = snapshot.unreviewed_ai_artifacts;

  return (
    <div className="rounded-xl border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          Shadow AI Risk
        </h3>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
            cfg.className
          )}
        >
          {cfg.label}
        </span>
      </div>

      {count === 0 ? (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Shield className="h-4 w-4" />
          Todos os artefatos AI possuem revisão humana registrada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {count}{" "}
                {count === 1
                  ? "artefato AI sem revisão humana"
                  : "artefatos AI sem revisão humana"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Artefatos gerados por AI sem revisão humana registrada aumentam
                o risco de compliance com o EU AI Act.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onStartReview}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Eye className="h-4 w-4" />
            Iniciar review
          </button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------

export function ComplianceDashboard({ projectId }: { projectId: string }) {
  const [periodDays, setPeriodDays] = useState(30);
  const [ipReport, setIpReport] = useState<IPAttributionReport | null>(null);

  const { data: snapshot, isLoading: snapshotLoading } =
    useComplianceSnapshot(projectId, periodDays);
  const createIpReport = useCreateIpReport(projectId);

  const isLoading = snapshotLoading;

  function handleGenerateIpReport() {
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - periodDays);
    const from = fromDate.toISOString().slice(0, 10);
    createIpReport.mutate({ from, to }, { onSuccess: (data) => setIpReport(data) });
  }

  if (ipReport) {
    return (
      <IPAttributionReportView
        report={ipReport}
        onClose={() => setIpReport(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Compliance & Governance
          </h2>
          <p className="text-sm text-muted-foreground">
            EU AI Act — rastreabilidade e atribuição de IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          {snapshot && <ShadowRiskBadge risk={snapshot.shadow_ai_risk} />}
          <button
            type="button"
            onClick={handleGenerateIpReport}
            disabled={createIpReport.isPending}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium shadow-sm hover:bg-muted disabled:opacity-50"
          >
            <FilePieChart className="h-3.5 w-3.5" />
            {createIpReport.isPending ? "Gerando..." : "Gerar Relatório IP"}
          </button>
          <ComplianceExportDialog projectId={projectId} />
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriodDays(opt.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  periodDays === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {isLoading && (
        <KpiCardGrid>
          {[1, 2, 3, 4].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
      )}

      {snapshot && (
        <KpiCardGrid>
          <KpiCard
            icon={Users}
            iconClassName="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            label="Proporção AI/Humano"
            value={formatPct(snapshot.ai_ratio)}
            subtitle={`${snapshot.total_artifacts} artefatos totais`}
          />
          <KpiCard
            icon={Eye}
            iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            label="Oversight Coverage"
            value={formatPct(snapshot.oversight_ratio)}
            subtitle={`${snapshot.human_oversight_events} eventos`}
          />
          <KpiCard
            icon={Shield}
            iconClassName="bg-green-500/10 text-green-600 dark:text-green-400"
            label="Review Coverage"
            value={formatPct(snapshot.review_coverage)}
            subtitle={`${snapshot.features_with_review}/${snapshot.features_total} features`}
          />
          <KpiCard
            icon={
              snapshot.unreviewed_ai_artifacts > 0 ? AlertTriangle : FileWarning
            }
            iconClassName={
              snapshot.unreviewed_ai_artifacts > 0
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-muted-foreground/10 text-muted-foreground"
            }
            label="AI sem Review"
            value={String(snapshot.unreviewed_ai_artifacts)}
            subtitle={
              snapshot.unreviewed_ai_artifacts > 0
                ? "Requer atenção"
                : "Tudo revisado"
            }
          />
        </KpiCardGrid>
      )}

      {/* Charts */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
      )}

      {snapshot && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Timeline de Decisões
            </h3>
            <DecisionTimeline projectId={projectId} />
          </div>
          <div className="rounded-xl border p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Proporção AI/Humano por Origem
            </h3>
            <ProportionStackedBar snapshot={snapshot} />
          </div>
        </div>
      )}

      {/* Shadow AI Risk Section */}
      {snapshot && <ShadowAiRiskSection snapshot={snapshot} />}
    </div>
  );
}

import { useState } from "react";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  DollarSign,
  Clock,
  Zap,
  AlertTriangle,
} from "lucide-react";
import { KpiCard, KpiCardSkeleton } from "@/components/kpi-card";
import {
  useProductivitySnapshot,
  type AIProductivitySnapshot,
} from "@/hooks/use-productivity-snapshot";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: 7, label: "7d" },
  { value: 14, label: "14d" },
  { value: 30, label: "30d" },
  { value: 90, label: "90d" },
] as const;

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function formatHours(h: number): string {
  if (h === 0) return "0h";
  const abs = Math.abs(h);
  if (abs < 1) return `${Math.round(abs * 60)}min`;
  return `${abs.toFixed(1)}h`;
}

function formatPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatUsd(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

// ----------------------------------------------------------------
// ROI Hero Card
// ----------------------------------------------------------------

function RoiHeroCard({ snapshot }: { snapshot: AIProductivitySnapshot }) {
  const roi = snapshot.net_roi_hours;
  const positive = roi >= 0;

  return (
    <div
      className={cn(
        "rounded-xl border p-6 shadow-sm",
        positive
          ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30"
          : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Net ROI</p>
          <div className="mt-1 flex items-center gap-2">
            {positive ? (
              <TrendingUp
                className="h-6 w-6 text-green-600 dark:text-green-400"
                aria-hidden
              />
            ) : (
              <TrendingDown
                className="h-6 w-6 text-red-600 dark:text-red-400"
                aria-hidden
              />
            )}
            <span
              className={cn(
                "text-4xl font-bold",
                positive
                  ? "text-green-700 dark:text-green-400"
                  : "text-red-700 dark:text-red-400"
              )}
            >
              {positive ? "+" : "-"}
              {formatHours(roi)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            no periodo selecionado
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:text-right">
          <BreakdownItem
            label="Economizado"
            value={`+${formatHours(snapshot.total_time_saved_hours)}`}
            valueClass="text-green-600 dark:text-green-400"
          />
          <BreakdownItem
            label="Revisando"
            value={`-${formatHours(snapshot.total_review_hours)}`}
            valueClass="text-yellow-600 dark:text-yellow-400"
          />
          <BreakdownItem
            label="Rework"
            value={`-${formatHours(snapshot.total_rework_hours)}`}
            valueClass="text-orange-600 dark:text-orange-400"
          />
          <BreakdownItem
            label="Custo"
            value={formatUsd(snapshot.total_ai_cost_usd)}
            valueClass="text-muted-foreground"
          />
        </div>
      </div>
    </div>
  );
}

function BreakdownItem({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold", valueClass)}>{value}</p>
    </div>
  );
}

// ----------------------------------------------------------------
// Verification Tax Bar
// ----------------------------------------------------------------

function VerificationTaxBar({ ratio }: { ratio: number }) {
  const pct = Math.min(ratio * 50, 100); // 2.0 ratio = 100% fill
  const color =
    ratio < 0.5
      ? "bg-green-500"
      : ratio < 1.0
        ? "bg-yellow-500"
        : "bg-red-500";

  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ----------------------------------------------------------------
// 6 KPI Cards
// ----------------------------------------------------------------

function ProductivityKpiCards({
  snapshot,
}: {
  snapshot: AIProductivitySnapshot;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {/* 1. AI Rework Ratio */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-orange-500/10 p-2 text-orange-600 dark:text-orange-400">
            <RefreshCw className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              AI Rework Ratio
            </p>
            <p className="text-2xl font-bold text-card-foreground">
              {formatPct(snapshot.ai_rework_ratio)}
            </p>
            <p className="text-xs text-muted-foreground">
              humano: {formatPct(snapshot.human_rework_ratio)}
            </p>
          </div>
        </div>
      </div>

      {/* 2. First-Pass Accuracy */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-green-500/10 p-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              First-Pass Accuracy
            </p>
            <p className="text-2xl font-bold text-card-foreground">
              {formatPct(snapshot.first_pass_accuracy)}
            </p>
            <p className="text-xs text-muted-foreground">
              aceitos sem modificacao
            </p>
          </div>
        </div>
      </div>

      {/* 3. Verification Tax */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-yellow-500/10 p-2 text-yellow-600 dark:text-yellow-400">
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Verification Tax
            </p>
            <p className="text-2xl font-bold text-card-foreground">
              {snapshot.verification_tax_ratio.toFixed(2)}x
            </p>
            <VerificationTaxBar ratio={snapshot.verification_tax_ratio} />
            <p className="mt-0.5 text-xs text-muted-foreground">
              review / geracao
            </p>
          </div>
        </div>
      </div>

      {/* 4. Defect Rate AI vs Human */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-red-500/10 p-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Defect Rate
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-card-foreground">
                {formatPct(snapshot.defect_introduction_rate_ai)}
              </p>
              <span className="text-xs text-muted-foreground">AI</span>
            </div>
            <p className="text-xs text-muted-foreground">
              humano: {formatPct(snapshot.defect_introduction_rate_human)}
            </p>
          </div>
        </div>
      </div>

      {/* 5. Features Completadas */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-blue-500/10 p-2 text-blue-600 dark:text-blue-400">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Features Completadas
            </p>
            <p className="text-2xl font-bold text-card-foreground">
              {snapshot.total_features}
            </p>
            <p className="text-xs text-muted-foreground">
              AI: {snapshot.ai_features} | Manual: {snapshot.human_features}
            </p>
          </div>
        </div>
      </div>

      {/* 6. Custo AI Total */}
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
            <DollarSign className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Custo AI Total
            </p>
            <p className="text-2xl font-bold text-card-foreground">
              {formatUsd(snapshot.total_ai_cost_usd)}
            </p>
            <p className="text-xs text-muted-foreground">
              {snapshot.ai_features} features AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Skeleton
// ----------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-[140px] w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <KpiCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function AIProductivityDashboard({
  projectId,
}: {
  projectId: string;
}) {
  const [periodDays, setPeriodDays] = useState<number>(30);

  const { data: snapshot, isLoading, isError, error, refetch } =
    useProductivitySnapshot(projectId, periodDays);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            AI esta realmente ajudando?
          </h2>
          <p className="text-sm text-muted-foreground">
            Rework, first-pass, verification tax e ROI liquido por periodo
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriodDays(opt.value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                periodDays === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && <DashboardSkeleton />}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Falha ao carregar dados: {(error as Error).message}
        </div>
      )}

      {/* Data */}
      {snapshot && (
        <>
          <RoiHeroCard snapshot={snapshot} />
          <ProductivityKpiCards snapshot={snapshot} />
        </>
      )}

      {/* Empty / no records */}
      {!isLoading && !isError && !snapshot && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center">
          <Zap className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            Sem dados de produtividade ainda
          </p>
          <p className="text-xs text-muted-foreground">
            Registre feature productivity records via API para ver metricas aqui.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  );
}

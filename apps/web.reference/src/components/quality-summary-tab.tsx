import {
  Shield,
  BarChart3,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { KpiCard, KpiCardGrid, KpiCardSkeleton } from "@/components/kpi-card";
import {
  useAllCoverageResults,
  useAllQualityResults,
  type TestCoverageResult,
  type ContributionQualityResult,
} from "@/hooks/use-feature-quality";

// --- Helpers ---

/** Deduplicate by feature_id keeping the most recent result */
function latestByFeature<T extends { feature_id: string | null; executed_at?: string; evaluated_at?: string }>(
  records: T[],
): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of records) {
    if (!r.feature_id) continue;
    const existing = map.get(r.feature_id);
    const rDate = (r as Record<string, unknown>).executed_at ?? (r as Record<string, unknown>).evaluated_at;
    const eDate = existing
      ? ((existing as Record<string, unknown>).executed_at ?? (existing as Record<string, unknown>).evaluated_at)
      : undefined;
    if (!existing || (typeof rDate === "string" && typeof eDate === "string" && rDate > eDate)) {
      map.set(r.feature_id, r);
    }
  }
  return map;
}

// --- Severity badge ---

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

// --- Main component ---

interface QualitySummaryTabProps {
  projectId: string;
}

export function QualitySummaryTab({ projectId }: QualitySummaryTabProps) {
  const { data: coverageResults, isLoading: coverageLoading } = useAllCoverageResults(projectId);
  const { data: qualityResults, isLoading: qualityLoading } = useAllQualityResults(projectId);

  const isLoading = coverageLoading || qualityLoading;

  // Compute KPIs from latest results per feature
  const coverageByFeature = coverageResults ? latestByFeature(coverageResults) : new Map<string, TestCoverageResult>();
  const qualityByFeature = qualityResults ? latestByFeature(qualityResults) : new Map<string, ContributionQualityResult>();

  const coverageEntries = [...coverageByFeature.values()];
  const qualityEntries = [...qualityByFeature.values()];

  const featuresWithCoverage = coverageEntries.length;
  const passingCoverage = coverageEntries.filter((r) => r.passed);
  const avgCoveragePassing =
    passingCoverage.length > 0
      ? passingCoverage.reduce((sum, r) => sum + r.overall_pct, 0) / passingCoverage.length
      : 0;

  const avgQualityScore =
    qualityEntries.length > 0
      ? qualityEntries.reduce((sum, r) => sum + r.overall_score, 0) / qualityEntries.length
      : 0;

  const autoRejected = qualityEntries.filter((r) => r.auto_rejected).length;

  const failedCoverage = coverageEntries.filter((r) => !r.passed);
  const featuresWithFlags = qualityEntries.filter((r) => r.flags.length > 0);

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Cards */}
      {isLoading ? (
        <KpiCardGrid>
          {[1, 2, 3, 4].map((i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </KpiCardGrid>
      ) : (
        <KpiCardGrid>
          <KpiCard
            icon={Shield}
            iconClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
            label="Features com coverage"
            value={featuresWithCoverage.toString()}
            subtitle={`${passingCoverage.length} passando`}
          />
          <KpiCard
            icon={BarChart3}
            iconClassName="bg-green-500/10 text-green-600 dark:text-green-400"
            label="Coverage media (passando)"
            value={`${avgCoveragePassing.toFixed(1)}%`}
          />
          <KpiCard
            icon={AlertTriangle}
            iconClassName="bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
            label="Score medio de qualidade"
            value={avgQualityScore.toFixed(1)}
            subtitle={`${qualityEntries.length} features avaliadas`}
          />
          <KpiCard
            icon={XCircle}
            iconClassName="bg-red-500/10 text-red-600 dark:text-red-400"
            label="Auto-rejeitadas no sprint"
            value={autoRejected.toString()}
          />
        </KpiCardGrid>
      )}

      {/* Features reprovadas no coverage */}
      {!isLoading && failedCoverage.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Features reprovadas no coverage
          </h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Coverage</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Threshold</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {failedCoverage.map((r) => (
                  <tr key={r.feature_id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono font-bold text-xs">{r.feature_id}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      <span className="text-red-600 dark:text-red-400">
                        {r.overall_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-muted-foreground">
                      {r.threshold_pct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                        Failed
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Features com flags de qualidade */}
      {!isLoading && featuresWithFlags.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            Features com flags de qualidade
          </h2>
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Feature</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Score</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Info</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Warning</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Error</th>
                </tr>
              </thead>
              <tbody>
                {featuresWithFlags.map((r) => {
                  const infoCount = r.flags.filter((f) => f.severity === "info").length;
                  const warnCount = r.flags.filter((f) => f.severity === "warning").length;
                  const errCount = r.flags.filter((f) => f.severity === "error").length;
                  return (
                    <tr key={r.feature_id ?? r.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono font-bold text-xs">
                        {r.feature_id ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        <span
                          className={cn(
                            r.overall_score >= 60
                              ? "text-green-600 dark:text-green-400"
                              : r.overall_score >= 30
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-red-600 dark:text-red-400",
                          )}
                        >
                          {r.overall_score.toFixed(0)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {infoCount > 0 && (
                          <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", SEVERITY_STYLES["info"])}>
                            {infoCount}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {warnCount > 0 && (
                          <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", SEVERITY_STYLES["warning"])}>
                            {warnCount}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {errCount > 0 && (
                          <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold", SEVERITY_STYLES["error"])}>
                            {errCount}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && featuresWithCoverage === 0 && qualityEntries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="size-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">
            Sem dados de qualidade ainda
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Dados aparecerao quando o coverage gate ou quality gate estiverem ativos.
          </p>
        </div>
      )}
    </div>
  );
}

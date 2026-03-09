import { cn } from "@/lib/utils";
import {
  useFeatureQuality,
  type TestCoverageResult,
  type ContributionQualityResult,
  type QualityFlag,
} from "@/hooks/use-feature-quality";

// --- Coverage bar with threshold line ---

function CoverageBar({ label, pct, threshold }: { label: string; pct: number; threshold: number }) {
  const aboveThreshold = pct >= threshold;
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-muted-foreground shrink-0">{label}</span>
      <div className="relative flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            aboveThreshold ? "bg-green-500" : "bg-red-500",
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {/* Threshold line */}
        <div
          className="absolute top-0 h-full w-0.5 bg-red-600"
          style={{ left: `${Math.min(threshold, 100)}%` }}
          title={`Threshold: ${threshold}%`}
        />
      </div>
      <span className="text-xs font-mono w-12 text-right">{pct.toFixed(1)}%</span>
    </div>
  );
}

// --- Quality score bar ---

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 text-xs text-muted-foreground shrink-0 capitalize">{label}</span>
      <div className="relative flex-1 h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score >= 70 ? "bg-green-500" : score >= 40 ? "bg-yellow-500" : "bg-red-500",
          )}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className="text-xs font-mono w-12 text-right">{score.toFixed(0)}</span>
    </div>
  );
}

// --- Severity badge ---

const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
        SEVERITY_STYLES[severity] ?? "bg-gray-100 text-gray-600",
      )}
    >
      {severity}
    </span>
  );
}

// --- Coverage section ---

function CoverageSection({ coverage }: { coverage: TestCoverageResult }) {
  const aboveThreshold = coverage.overall_pct >= coverage.threshold_pct;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Test Coverage</h4>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              coverage.passed
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
            )}
          >
            {coverage.passed ? "Passed" : "Failed"}
          </span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold",
              aboveThreshold
                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
            )}
          >
            {coverage.overall_pct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        <CoverageBar label="Lines" pct={coverage.lines_pct} threshold={coverage.threshold_pct} />
        <CoverageBar label="Branches" pct={coverage.branches_pct} threshold={coverage.threshold_pct} />
        <CoverageBar label="Functions" pct={coverage.functions_pct} threshold={coverage.threshold_pct} />
        <CoverageBar label="Statements" pct={coverage.statements_pct} threshold={coverage.threshold_pct} />
      </div>

      {coverage.uncovered_files.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Arquivos sem cobertura ({coverage.uncovered_files.length})
          </span>
          <ul className="mt-1 space-y-0.5">
            {coverage.uncovered_files.map((f) => (
              <li key={f} className="text-xs font-mono text-muted-foreground truncate">
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// --- Quality section ---

const DIMENSION_LABELS: Record<string, string> = {
  originality: "Originalidade",
  test_coverage: "Cobertura",
  code_duplication: "Duplicacao",
  security: "Seguranca",
  architectural_conformance: "ACR",
};

function QualitySection({ quality }: { quality: ContributionQualityResult }) {
  const scoreColor = quality.auto_rejected
    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
    : quality.passed
      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";

  const scoreLabel = quality.auto_rejected
    ? "Auto-rejeitado"
    : quality.passed
      ? "Aprovado"
      : "Reprovado";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Contribution Quality</h4>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              scoreColor,
            )}
          >
            {scoreLabel}
          </span>
          <span className="text-lg font-bold">{quality.overall_score.toFixed(0)}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        {Object.entries(quality.scores).map(([key, value]) => (
          <ScoreBar key={key} label={DIMENSION_LABELS[key] ?? key} score={value} />
        ))}
      </div>

      {quality.flags.length > 0 && (
        <div>
          <span className="text-xs font-medium text-muted-foreground">
            Flags ({quality.flags.length})
          </span>
          <ul className="mt-1 space-y-1">
            {quality.flags.map((flag, i) => (
              <FlagItem key={i} flag={flag} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FlagItem({ flag }: { flag: QualityFlag }) {
  const location = flag.file
    ? `${flag.file}${flag.line != null ? `:${flag.line}` : ""}`
    : null;

  return (
    <li className="flex items-start gap-1.5 text-xs">
      <SeverityBadge severity={flag.severity} />
      <div className="min-w-0">
        <span className="text-foreground">{flag.message}</span>
        {location && (
          <span className="block text-muted-foreground font-mono truncate">
            {location}
          </span>
        )}
      </div>
    </li>
  );
}

// --- Main panel ---

interface FeatureQualityPanelProps {
  projectSlug: string;
  sprint: number;
  featureId: string;
}

export function FeatureQualityPanel({ projectSlug, sprint, featureId }: FeatureQualityPanelProps) {
  const { data, isLoading } = useFeatureQuality(projectSlug, sprint, featureId);

  if (isLoading) {
    return (
      <div>
        <span className="text-xs text-muted-foreground">Qualidade</span>
        <div className="mt-1 h-20 animate-pulse rounded-lg border bg-muted" />
      </div>
    );
  }

  if (!data || (!data.coverage && !data.quality)) {
    return null;
  }

  return (
    <div>
      <span className="text-xs text-muted-foreground">Qualidade</span>
      <div className="mt-1 space-y-4 rounded-lg border p-3">
        {data.coverage && <CoverageSection coverage={data.coverage} />}
        {data.coverage && data.quality && <hr className="border-muted" />}
        {data.quality && <QualitySection quality={data.quality} />}
      </div>
    </div>
  );
}

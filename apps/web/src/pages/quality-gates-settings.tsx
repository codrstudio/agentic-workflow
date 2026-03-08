import { useState, useEffect } from "react";
import { useParams, Link } from "@tanstack/react-router";
import {
  Shield,
  TestTube,
  Star,
  Loader2,
  ArrowLeft,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  useTestCoverageGateConfig,
  useUpdateTestCoverageGateConfig,
  useContributionQualityConfig,
  useUpdateContributionQualityConfig,
  TEST_COVERAGE_DEFAULTS,
  CONTRIBUTION_QUALITY_DEFAULTS,
  type TestCoverageGateConfig,
  type ContributionQualityConfig,
} from "@/hooks/use-quality-gate-configs";

// --- Reusable controls ---

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-primary" : "bg-input"
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-medium tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function CheckboxWithTooltip({
  label,
  tooltip,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  tooltip: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <Label className="text-sm cursor-pointer">{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="size-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// --- Coverage tool options ---

const COVERAGE_TOOLS = [
  { value: "vitest", label: "Vitest" },
  { value: "jest", label: "Jest" },
  { value: "c8", label: "c8" },
  { value: "custom", label: "Custom" },
] as const;

// --- Contribution quality checks ---

const QUALITY_CHECKS = [
  {
    key: "check_ai_patterns" as const,
    label: "AI Patterns",
    tooltip:
      "Detecta padroes tipicos de codigo gerado por AI: variaveis genericas, comentarios placeholder, blocos duplicados e trechos copiados sem adaptacao.",
  },
  {
    key: "check_test_coverage" as const,
    label: "Test Coverage",
    tooltip:
      "Verifica se a contribuicao inclui testes adequados para o codigo adicionado ou modificado, incluindo testes unitarios e de integracao.",
  },
  {
    key: "check_code_duplication" as const,
    label: "Code Duplication",
    tooltip:
      "Analisa duplicacao de codigo na contribuicao, identificando trechos repetidos que deveriam ser extraidos em funcoes ou modulos reutilizaveis.",
  },
  {
    key: "check_security_patterns" as const,
    label: "Security Patterns",
    tooltip:
      "Escaneia vulnerabilidades de seguranca como SQL injection, XSS, secrets hardcoded, dependencias inseguras e padroes OWASP Top 10.",
  },
  {
    key: "check_architectural_conformance" as const,
    label: "ACR Conformance",
    tooltip:
      "Valida conformidade com os Architectural Constraint Records (ACRs) do projeto, verificando violacoes de regras arquiteturais definidas.",
  },
];

// --- Test Coverage Gate Section ---

type LocalCoverage = Omit<TestCoverageGateConfig, "project_id" | "updated_at">;

function TestCoverageGateSection({
  projectSlug,
}: {
  projectSlug: string;
}) {
  const { data, isLoading } = useTestCoverageGateConfig(projectSlug);
  const updateConfig = useUpdateTestCoverageGateConfig(projectSlug);

  const [local, setLocal] = useState<LocalCoverage>(TEST_COVERAGE_DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setLocal({
        enabled: data.enabled,
        coverage_threshold_pct: data.coverage_threshold_pct,
        coverage_tool: data.coverage_tool,
        custom_command: data.custom_command,
        report_dir: data.report_dir,
        fail_on_uncovered_files: data.fail_on_uncovered_files,
      });
      setDirty(false);
    }
  }, [data]);

  const update = <K extends keyof LocalCoverage>(
    key: K,
    value: LocalCoverage[K]
  ) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateConfig.mutate(local, {
      onSuccess: () => setDirty(false),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TestTube className="size-5" />
          <h2 className="text-base font-semibold">Test Coverage Gate</h2>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending && (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              )}
              Salvar
            </Button>
          )}
          <Toggle
            checked={local.enabled}
            onChange={(v) => update("enabled", v)}
            disabled={updateConfig.isPending}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Exige cobertura de testes minima para features passarem no quality gate.
      </p>

      <div className="space-y-5 rounded-lg border bg-card p-4">
        {/* Coverage tool select */}
        <div className="space-y-2">
          <Label className="text-sm">Ferramenta de cobertura</Label>
          <div className="flex gap-2 flex-wrap">
            {COVERAGE_TOOLS.map((tool) => (
              <button
                key={tool.value}
                type="button"
                disabled={updateConfig.isPending}
                onClick={() => update("coverage_tool", tool.value)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  local.coverage_tool === tool.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted border-input"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {tool.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom command - conditional */}
        {local.coverage_tool === "custom" && (
          <div className="space-y-2">
            <Label className="text-sm">Comando customizado</Label>
            <input
              type="text"
              value={local.custom_command ?? ""}
              onChange={(e) =>
                update("custom_command", e.target.value || null)
              }
              placeholder="ex: npx c8 --reporter=json-summary npm test"
              disabled={updateConfig.isPending}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
          </div>
        )}

        {/* Coverage threshold slider */}
        <SliderField
          label="Cobertura minima"
          value={local.coverage_threshold_pct}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => update("coverage_threshold_pct", v)}
          disabled={updateConfig.isPending}
        />

        {/* Fail on uncovered files toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Reprovar arquivos sem cobertura</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Features falham se houver arquivos novos sem nenhum teste.
            </p>
          </div>
          <Toggle
            checked={local.fail_on_uncovered_files}
            onChange={(v) => update("fail_on_uncovered_files", v)}
            disabled={updateConfig.isPending}
          />
        </div>
      </div>
    </div>
  );
}

// --- Contribution Quality Gate Section ---

type LocalQuality = Omit<ContributionQualityConfig, "project_id" | "updated_at">;

function ContributionQualityGateSection({
  projectSlug,
}: {
  projectSlug: string;
}) {
  const { data, isLoading } = useContributionQualityConfig(projectSlug);
  const updateConfig = useUpdateContributionQualityConfig(projectSlug);

  const [local, setLocal] = useState<LocalQuality>(CONTRIBUTION_QUALITY_DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data) {
      setLocal({
        enabled: data.enabled,
        min_quality_score: data.min_quality_score,
        auto_reject_below: data.auto_reject_below,
        check_ai_patterns: data.check_ai_patterns,
        check_test_coverage: data.check_test_coverage,
        check_code_duplication: data.check_code_duplication,
        check_security_patterns: data.check_security_patterns,
        check_architectural_conformance: data.check_architectural_conformance,
      });
      setDirty(false);
    }
  }, [data]);

  const update = <K extends keyof LocalQuality>(
    key: K,
    value: LocalQuality[K]
  ) => {
    setLocal((prev) => {
      const next = { ...prev, [key]: value };
      // Enforce: auto_reject_below <= min_quality_score
      if (key === "min_quality_score" && next.auto_reject_below > (value as number)) {
        next.auto_reject_below = value as number;
      }
      if (key === "auto_reject_below" && (value as number) > next.min_quality_score) {
        next.auto_reject_below = next.min_quality_score;
      }
      return next;
    });
    setDirty(true);
  };

  const handleSave = () => {
    updateConfig.mutate(local, {
      onSuccess: () => setDirty(false),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="size-5" />
          <h2 className="text-base font-semibold">
            Contribution Quality Gate
          </h2>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateConfig.isPending}
            >
              {updateConfig.isPending && (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              )}
              Salvar
            </Button>
          )}
          <Toggle
            checked={local.enabled}
            onChange={(v) => update("enabled", v)}
            disabled={updateConfig.isPending}
          />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Avalia a qualidade de contribuicoes com scoring multi-dimensional e
        rejeicao automatica.
      </p>

      <div className="space-y-5 rounded-lg border bg-card p-4">
        {/* Min quality score slider */}
        <SliderField
          label="Score minimo para aprovacao"
          value={local.min_quality_score}
          min={0}
          max={100}
          step={5}
          unit="%"
          onChange={(v) => update("min_quality_score", v)}
          disabled={updateConfig.isPending}
        />

        {/* Auto-reject below slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Auto-rejeitar abaixo de</Label>
            <span className="text-sm font-medium tabular-nums">
              {local.auto_reject_below}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={local.min_quality_score}
            step={5}
            value={local.auto_reject_below}
            disabled={updateConfig.isPending}
            onChange={(e) =>
              update("auto_reject_below", Number(e.target.value))
            }
            className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0%</span>
            <span>{local.min_quality_score}% (score minimo)</span>
          </div>
        </div>

        {/* Quality checks */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Verificacoes ativas</Label>
          {QUALITY_CHECKS.map((check) => (
            <CheckboxWithTooltip
              key={check.key}
              label={check.label}
              tooltip={check.tooltip}
              checked={local[check.key]}
              onChange={(v) => update(check.key, v)}
              disabled={updateConfig.isPending}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// --- Page ---

export function QualityGatesSettingsPage() {
  const { projectId } = useParams({
    from: "/_authenticated/projects/$projectId/settings/quality-gates",
  });

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="size-5" />
              <h1 className="text-lg font-semibold">Quality Gates</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure gates de qualidade para cobertura de testes e qualidade
              de contribuicoes.
            </p>
          </div>
        </div>

        <TestCoverageGateSection projectSlug={projectId} />

        <div className="border-t pt-6">
          <ContributionQualityGateSection projectSlug={projectId} />
        </div>
      </div>
    </div>
  );
}

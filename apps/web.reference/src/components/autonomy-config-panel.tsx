import { useState, useEffect } from "react";
import {
  Lightbulb,
  FileText,
  BookOpen,
  Code2,
  Eye,
  GitMerge,
  RotateCcw,
  Loader2,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  usePhaseAutonomyConfigs,
  usePatchPhaseAutonomy,
  type PhaseAutonomyConfig,
  type AutonomyLevel,
  type EscalationAction,
  type PipelinePhase,
} from "@/hooks/use-phase-autonomy";

// ----------------------------------------------------------------
// Phase metadata
// ----------------------------------------------------------------

const PHASE_META: Record<
  PipelinePhase,
  { label: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  brainstorming: { label: "Brainstorming", Icon: Lightbulb },
  specs: { label: "Specs", Icon: FileText },
  prps: { label: "PRPs", Icon: BookOpen },
  implementation: { label: "Implementacao", Icon: Code2 },
  review: { label: "Review", Icon: Eye },
  merge: { label: "Merge", Icon: GitMerge },
};

const ALL_PHASES: PipelinePhase[] = [
  "brainstorming",
  "specs",
  "prps",
  "implementation",
  "review",
  "merge",
];

// ----------------------------------------------------------------
// Labels
// ----------------------------------------------------------------

const AUTONOMY_LEVEL_LABELS: Record<AutonomyLevel, string> = {
  full_auto: "Totalmente automatico",
  auto_with_review: "Auto com revisao",
  approval_required: "Aprovacao obrigatoria",
  manual_only: "Apenas manual",
};

const ESCALATION_ACTION_LABELS: Record<EscalationAction, string> = {
  notify: "Notificar",
  block: "Bloquear",
  fallback_manual: "Fallback manual",
};

// ----------------------------------------------------------------
// Presets
// ----------------------------------------------------------------

const BALANCEADO_DEFAULTS: Record<
  PipelinePhase,
  Omit<PhaseAutonomyConfig, "updated_at">
> = {
  brainstorming: {
    phase: "brainstorming",
    autonomy_level: "full_auto",
    confidence_threshold: 0.7,
    require_sign_off: false,
    max_auto_retries: 3,
    escalation_action: "notify",
  },
  specs: {
    phase: "specs",
    autonomy_level: "auto_with_review",
    confidence_threshold: 0.85,
    require_sign_off: false,
    max_auto_retries: 2,
    escalation_action: "notify",
  },
  prps: {
    phase: "prps",
    autonomy_level: "approval_required",
    confidence_threshold: 0.85,
    require_sign_off: true,
    max_auto_retries: 1,
    escalation_action: "block",
  },
  implementation: {
    phase: "implementation",
    autonomy_level: "auto_with_review",
    confidence_threshold: 0.85,
    require_sign_off: false,
    max_auto_retries: 2,
    escalation_action: "notify",
  },
  review: {
    phase: "review",
    autonomy_level: "full_auto",
    confidence_threshold: 0.7,
    require_sign_off: false,
    max_auto_retries: 3,
    escalation_action: "notify",
  },
  merge: {
    phase: "merge",
    autonomy_level: "approval_required",
    confidence_threshold: 0.9,
    require_sign_off: true,
    max_auto_retries: 0,
    escalation_action: "block",
  },
};

function makeConservadorConfig(phase: PipelinePhase): Omit<PhaseAutonomyConfig, "updated_at"> {
  return {
    phase,
    autonomy_level: "approval_required",
    confidence_threshold: 0.9,
    require_sign_off: true,
    max_auto_retries: 1,
    escalation_action: "block",
  };
}

function makeAutonomoConfig(phase: PipelinePhase): Omit<PhaseAutonomyConfig, "updated_at"> {
  return {
    phase,
    autonomy_level: "auto_with_review",
    confidence_threshold: 0.7,
    require_sign_off: false,
    max_auto_retries: 3,
    escalation_action: "notify",
  };
}

// ----------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------

function SelectField<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-full h-8 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {labels[opt]}
          </option>
        ))}
      </select>
    </div>
  );
}

function SliderField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-medium tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={0.5}
        max={1.0}
        step={0.05}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>0.50</span>
        <span>1.00</span>
      </div>
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          value ? "bg-primary" : "bg-input"
        }`}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform ${
            value ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <input
        type="number"
        min={0}
        max={5}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const v = Math.max(0, Math.min(5, Number(e.target.value)));
          onChange(v);
        }}
        className="h-7 w-14 rounded-md border bg-background px-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
    </div>
  );
}

function PhaseCard({
  config,
  onUpdate,
  disabled,
}: {
  config: PhaseAutonomyConfig;
  onUpdate: (phase: PipelinePhase, updates: Partial<PhaseAutonomyConfig>) => void;
  disabled: boolean;
}) {
  const meta = PHASE_META[config.phase];
  const { Icon, label } = meta;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>

      <SelectField<AutonomyLevel>
        label="Nivel de autonomia"
        value={config.autonomy_level}
        options={["full_auto", "auto_with_review", "approval_required", "manual_only"]}
        labels={AUTONOMY_LEVEL_LABELS}
        onChange={(v) => onUpdate(config.phase, { autonomy_level: v })}
        disabled={disabled}
      />

      <SliderField
        label="Threshold de confianca"
        value={config.confidence_threshold}
        onChange={(v) => onUpdate(config.phase, { confidence_threshold: v })}
        disabled={disabled}
      />

      <ToggleField
        label="Exigir sign-off"
        value={config.require_sign_off}
        onChange={(v) => onUpdate(config.phase, { require_sign_off: v })}
        disabled={disabled}
      />

      <NumberField
        label="Max retries auto (0-5)"
        value={config.max_auto_retries}
        onChange={(v) => onUpdate(config.phase, { max_auto_retries: v })}
        disabled={disabled}
      />

      <SelectField<EscalationAction>
        label="Acao de escalacao"
        value={config.escalation_action}
        options={["notify", "block", "fallback_manual"]}
        labels={ESCALATION_ACTION_LABELS}
        onChange={(v) => onUpdate(config.phase, { escalation_action: v })}
        disabled={disabled}
      />
    </div>
  );
}

// ----------------------------------------------------------------
// Main component
// ----------------------------------------------------------------

export function AutonomyConfigPanel({ projectSlug }: { projectSlug: string }) {
  const { data, isLoading } = usePhaseAutonomyConfigs(projectSlug);
  const patchPhase = usePatchPhaseAutonomy(projectSlug);

  const [drafts, setDrafts] = useState<PhaseAutonomyConfig[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.phases) {
      setDrafts(data.phases);
      setDirty(false);
    }
  }, [data]);

  const updatePhase = (
    phase: PipelinePhase,
    updates: Partial<PhaseAutonomyConfig>
  ) => {
    setDrafts((prev) =>
      prev.map((p) => (p.phase === phase ? { ...p, ...updates } : p))
    );
    setDirty(true);
  };

  const applyPreset = (preset: "conservador" | "balanceado" | "autonomo") => {
    const now = new Date().toISOString();
    setDrafts(
      ALL_PHASES.map((phase) => {
        let base: Omit<PhaseAutonomyConfig, "updated_at">;
        if (preset === "conservador") base = makeConservadorConfig(phase);
        else if (preset === "autonomo") base = makeAutonomoConfig(phase);
        else base = BALANCEADO_DEFAULTS[phase];
        return { ...base, updated_at: now };
      })
    );
    setDirty(true);
  };

  const handleSave = async () => {
    await Promise.all(
      drafts.map((d) =>
        patchPhase.mutateAsync({
          phase: d.phase,
          autonomy_level: d.autonomy_level,
          confidence_threshold: d.confidence_threshold,
          require_sign_off: d.require_sign_off,
          max_auto_retries: d.max_auto_retries,
          escalation_action: d.escalation_action,
        })
      )
    );
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleRestoreDefaults = () => {
    const now = new Date().toISOString();
    setDrafts(
      ALL_PHASES.map((phase) => ({
        ...BALANCEADO_DEFAULTS[phase],
        updated_at: now,
      }))
    );
    setDirty(true);
  };

  const isSaving = patchPhase.isPending;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Shield className="size-5" />
          <h2 className="text-base font-semibold">Autonomia</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRestoreDefaults}
            disabled={isSaving}
          >
            <RotateCcw className="size-3.5 mr-1.5" />
            Restaurar defaults
          </Button>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {saved ? "Salvo!" : "Salvar"}
            </Button>
          )}
          {saved && !dirty && (
            <span className="text-sm text-green-600 font-medium">
              Configuracoes salvas.
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure o nivel de autonomia do agente por fase do pipeline. Use os
        presets como ponto de partida.
      </p>

      {/* Preset buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Presets:</span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={isSaving}
          onClick={() => applyPreset("conservador")}
        >
          Conservador
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={isSaving}
          onClick={() => applyPreset("balanceado")}
        >
          Balanceado
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          disabled={isSaving}
          onClick={() => applyPreset("autonomo")}
        >
          Autonomo
        </Button>
      </div>

      {/* Phase cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {drafts.map((config) => (
          <PhaseCard
            key={config.phase}
            config={config}
            onUpdate={updatePhase}
            disabled={isSaving}
          />
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Heart, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGuardrails,
  useUpdateGuardrails,
  GUARDRAILS_DEFAULTS,
  type WorkGuardrails,
} from "@/hooks/use-guardrails";

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
          {value} {unit}
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
          {min} {unit}
        </span>
        <span>
          {max} {unit}
        </span>
      </div>
    </div>
  );
}

export function GuardrailsSettings({
  projectSlug,
}: {
  projectSlug: string;
}) {
  const { data: guardrails, isLoading } = useGuardrails(projectSlug);
  const updateGuardrails = useUpdateGuardrails(projectSlug);

  const [local, setLocal] = useState<WorkGuardrails>(GUARDRAILS_DEFAULTS);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (guardrails) {
      setLocal(guardrails);
      setDirty(false);
    }
  }, [guardrails]);

  const update = <K extends keyof WorkGuardrails>(
    key: K,
    value: WorkGuardrails[K]
  ) => {
    setLocal((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    updateGuardrails.mutate(local, {
      onSuccess: () => setDirty(false),
    });
  };

  const handleRestore = () => {
    updateGuardrails.mutate(GUARDRAILS_DEFAULTS, {
      onSuccess: () => {
        setLocal(GUARDRAILS_DEFAULTS);
        setDirty(false);
      },
    });
  };

  const isDefault =
    guardrails &&
    Object.keys(GUARDRAILS_DEFAULTS).every(
      (k) =>
        guardrails[k as keyof WorkGuardrails] ===
        GUARDRAILS_DEFAULTS[k as keyof WorkGuardrails]
    );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="size-5" />
          <h2 className="text-base font-semibold">Bem-estar</h2>
        </div>
        <div className="flex items-center gap-2">
          {!isDefault && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRestore}
              disabled={updateGuardrails.isPending}
            >
              <RotateCcw className="size-3.5 mr-1.5" />
              Restaurar defaults
            </Button>
          )}
          {dirty && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={updateGuardrails.isPending}
            >
              {updateGuardrails.isPending && (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              )}
              Salvar
            </Button>
          )}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure limites e alertas para proteger contra burnout e sobrecarga
        cognitiva.
      </p>

      <div className="space-y-5 rounded-lg border bg-card p-4">
        <SliderField
          label="Limite de duracao de sessao"
          value={local.session_duration_limit}
          min={30}
          max={480}
          step={15}
          unit="min"
          onChange={(v) => update("session_duration_limit", v)}
          disabled={updateGuardrails.isPending}
        />

        <SliderField
          label="Limite diario de atividade"
          value={local.daily_active_limit}
          min={60}
          max={720}
          step={30}
          unit="min"
          onChange={(v) => update("daily_active_limit", v)}
          disabled={updateGuardrails.isPending}
        />

        <SliderField
          label="Intervalo de lembrete de pausa"
          value={local.break_reminder_interval}
          min={15}
          max={120}
          step={5}
          unit="min"
          onChange={(v) => update("break_reminder_interval", v)}
          disabled={updateGuardrails.isPending}
        />

        <SliderField
          label="Limite de trocas de contexto (alerta)"
          value={local.context_switch_warning_threshold}
          min={1}
          max={20}
          step={1}
          unit="trocas"
          onChange={(v) => update("context_switch_warning_threshold", v)}
          disabled={updateGuardrails.isPending}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Hora tardia (threshold)</Label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={23}
                value={local.late_hour_threshold}
                disabled={updateGuardrails.isPending}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(23, Number(e.target.value)));
                  update("late_hour_threshold", v);
                }}
                className="h-8 w-16 rounded-md border bg-background px-2 text-sm text-center tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              <span className="text-sm text-muted-foreground">h</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Sessoes apos este horario serao sinalizadas como tardias.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Alertas de fim de semana</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sinalizar sessoes em sabados e domingos.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={local.weekend_alerts_enabled}
            disabled={updateGuardrails.isPending}
            onClick={() =>
              update("weekend_alerts_enabled", !local.weekend_alerts_enabled)
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              local.weekend_alerts_enabled ? "bg-primary" : "bg-input"
            }`}
          >
            <span
              className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform ${
                local.weekend_alerts_enabled
                  ? "translate-x-5"
                  : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}

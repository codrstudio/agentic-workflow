import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import {
  agentQueryOptions,
  extractHeartbeatConfig,
  saveHeartbeatConfig,
  type HeartbeatConfigData,
} from "@/api/agents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";

const DAYS_OF_WEEK = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
] as const;

const DAY_NAMES: Record<number, string> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
};

function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`;
  if (seconds < 3600) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return sec > 0 ? `${min}min ${sec}s` : `${min} minutos`;
  }
  const h = Math.floor(seconds / 3600);
  const min = Math.floor((seconds % 3600) / 60);
  return min > 0 ? `${h}h ${min}min` : `${h} hora${h > 1 ? "s" : ""}`;
}

function buildPreview(config: HeartbeatConfigData): string {
  if (!config.enabled) return "Heartbeat desativado.";

  const parts: string[] = [];
  parts.push(`Heartbeat a cada ${formatInterval(config.intervalMs / 1000)}`);

  if (config.activeHoursStart && config.activeHoursEnd) {
    parts.push(`das ${config.activeHoursStart} as ${config.activeHoursEnd}`);
  }

  if (config.activeHoursDays && config.activeHoursDays.length > 0 && config.activeHoursDays.length < 7) {
    if (config.activeHoursDays.length === 5 && [1, 2, 3, 4, 5].every((d) => config.activeHoursDays!.includes(d))) {
      parts.push("de segunda a sexta");
    } else {
      const names = config.activeHoursDays
        .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
        .map((d) => DAY_NAMES[d] ?? String(d));
      parts.push(names.join(", "));
    }
  }

  return parts.join(", ") + ".";
}

interface HeartbeatConfigProps {
  agentId: string;
}

export function HeartbeatConfig({ agentId }: HeartbeatConfigProps) {
  const queryClient = useQueryClient();
  const { data: agent, isLoading } = useQuery(agentQueryOptions(agentId));

  const [config, setConfig] = useState<HeartbeatConfigData | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (agent && !config) {
      setConfig(extractHeartbeatConfig(agent as Parameters<typeof extractHeartbeatConfig>[0]));
    }
  }, [agent, config]);

  const mutation = useMutation({
    mutationFn: (data: HeartbeatConfigData) => saveHeartbeatConfig(agentId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      setIsDirty(false);
    },
  });

  function update(partial: Partial<HeartbeatConfigData>) {
    setConfig((prev) => (prev ? { ...prev, ...partial } : prev));
    setIsDirty(true);
  }

  if (isLoading || !config) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const intervalSeconds = Math.round(config.intervalMs / 1000);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuracao do Heartbeat</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enabled */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="hb-enabled" className="text-sm font-medium">Heartbeat ativo</Label>
              <p className="text-xs text-muted-foreground">Ativa o ciclo autonomo do agente</p>
            </div>
            <Switch
              id="hb-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => update({ enabled: checked })}
            />
          </div>

          <Separator />

          {/* Interval */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Intervalo (segundos)</Label>
            <div className="flex items-center gap-4">
              <Slider
                min={10}
                max={3600}
                step={10}
                value={[intervalSeconds]}
                onValueChange={(v) => {
                  const val = Array.isArray(v) ? v[0] : v;
                  if (val !== undefined) update({ intervalMs: val * 1000 });
                }}
                className="flex-1"
              />
              <Input
                type="number"
                min={10}
                max={3600}
                value={intervalSeconds}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 10 && v <= 3600) {
                    update({ intervalMs: v * 1000 });
                  }
                }}
                className="w-24"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatInterval(intervalSeconds)}
            </p>
          </div>

          <Separator />

          {/* Active hours */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Horario ativo</Label>
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <Label htmlFor="hb-start" className="text-xs text-muted-foreground">Inicio</Label>
                <Input
                  id="hb-start"
                  type="time"
                  value={config.activeHoursStart ?? ""}
                  onChange={(e) => update({ activeHoursStart: e.target.value || undefined })}
                  className="w-32"
                />
              </div>
              <span className="mt-5 text-muted-foreground">ate</span>
              <div className="space-y-1">
                <Label htmlFor="hb-end" className="text-xs text-muted-foreground">Fim</Label>
                <Input
                  id="hb-end"
                  type="time"
                  value={config.activeHoursEnd ?? ""}
                  onChange={(e) => update({ activeHoursEnd: e.target.value || undefined })}
                  className="w-32"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Days of week */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Dias da semana</Label>
            <div className="flex flex-wrap gap-4">
              {DAYS_OF_WEEK.map((day) => {
                const checked = config.activeHoursDays?.includes(day.value) ?? false;
                return (
                  <label key={day.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(c) => {
                        const current = config.activeHoursDays ?? [];
                        const next = c
                          ? [...current, day.value]
                          : current.filter((d) => d !== day.value);
                        update({ activeHoursDays: next.length > 0 ? next : undefined });
                      }}
                    />
                    <span className="text-sm">{day.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Preview: </span>
            {buildPreview(config)}
          </p>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button
          onClick={() => mutation.mutate(config)}
          disabled={!isDirty || mutation.isPending}
        >
          <Save className="mr-2 size-4" />
          {mutation.isPending ? "Salvando..." : "Salvar"}
        </Button>
        {mutation.isError && (
          <p className="text-sm text-destructive">Erro ao salvar configuracao.</p>
        )}
        {mutation.isSuccess && !isDirty && (
          <p className="text-sm text-muted-foreground">Configuracao salva.</p>
        )}
      </div>
    </div>
  );
}

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Save,
  Play,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  circuitBreakerQueryOptions,
  circuitBreakerEventsQueryOptions,
  updateCircuitBreakerConfig,
  activateKillSwitch,
  resumeCircuitBreaker,
} from "@/api/circuit-breaker";
import type { UpdateCircuitBreakerConfig, CircuitBreakerEventType } from "@/api/circuit-breaker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSSEEvent } from "@/hooks/use-sse";

interface CircuitBreakerTabProps {
  agentId: string;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

function eventTypeLabel(type: CircuitBreakerEventType): string {
  switch (type) {
    case "tripped": return "Disparado";
    case "resumed": return "Retomado";
    case "kill_switch_on": return "Kill-switch ativado";
    case "kill_switch_off": return "Kill-switch desativado";
    case "action_blocked": return "Ação bloqueada";
  }
}

function eventTypeBadgeVariant(
  type: CircuitBreakerEventType,
): "destructive" | "secondary" | "default" | "outline" {
  switch (type) {
    case "tripped": return "destructive";
    case "kill_switch_on": return "destructive";
    case "kill_switch_off": return "default";
    case "resumed": return "default";
    case "action_blocked": return "secondary";
  }
}

export function CircuitBreakerTab({ agentId }: CircuitBreakerTabProps) {
  const queryClient = useQueryClient();

  const { data: state, isLoading } = useQuery(circuitBreakerQueryOptions(agentId));
  const { data: events, isLoading: eventsLoading } = useQuery(
    circuitBreakerEventsQueryOptions(agentId),
  );

  const [form, setForm] = useState<UpdateCircuitBreakerConfig>({});
  const [dirty, setDirty] = useState(false);

  function setField<K extends keyof UpdateCircuitBreakerConfig>(
    key: K,
    value: UpdateCircuitBreakerConfig[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["circuit-breaker", agentId] });
  }, [queryClient, agentId]);

  // Real-time SSE updates
  useSSEEvent(
    "circuit_breaker:tripped",
    useCallback(
      (event) => {
        if (event.data?.agentId === agentId) invalidate();
      },
      [agentId, invalidate],
    ),
  );
  useSSEEvent(
    "circuit_breaker:resumed",
    useCallback(
      (event) => {
        if (event.data?.agentId === agentId) invalidate();
      },
      [agentId, invalidate],
    ),
  );
  useSSEEvent(
    "circuit_breaker:kill_switch",
    useCallback(
      (event) => {
        if (event.data?.agentId === agentId) invalidate();
      },
      [agentId, invalidate],
    ),
  );

  const killMutation = useMutation({
    mutationFn: () => activateKillSwitch(agentId),
    onSuccess: () => {
      toast.success("Kill-switch ativado — agente parado");
      invalidate();
    },
    onError: () => toast.error("Erro ao ativar kill-switch"),
  });

  const resumeMutation = useMutation({
    mutationFn: () => resumeCircuitBreaker(agentId),
    onSuccess: () => {
      toast.success("Agente retomado");
      invalidate();
    },
    onError: () => toast.error("Erro ao retomar agente"),
  });

  const saveMutation = useMutation({
    mutationFn: () => updateCircuitBreakerConfig(agentId, form),
    onSuccess: () => {
      toast.success("Configuração salva");
      invalidate();
      setDirty(false);
    },
    onError: () => toast.error("Erro ao salvar configuração"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-36 w-full" />
      </div>
    );
  }

  if (!state) {
    return (
      <p className="text-muted-foreground text-sm">
        Não foi possível carregar o circuit-breaker.
      </p>
    );
  }

  const { config } = state;
  const isKillActive = state.killSwitch;
  const isTripped = state.tripped;

  // Effective config values (form overrides loaded config)
  const cfg = {
    enabled: form.enabled !== undefined ? form.enabled : config.enabled,
    maxConsecutiveFails:
      form.maxConsecutiveFails !== undefined
        ? form.maxConsecutiveFails
        : config.maxConsecutiveFails,
    errorRateThreshold:
      form.errorRateThreshold !== undefined
        ? form.errorRateThreshold
        : config.errorRateThreshold,
    errorRateWindowMin:
      form.errorRateWindowMin !== undefined
        ? form.errorRateWindowMin
        : config.errorRateWindowMin,
    maxActionsPerHour:
      form.maxActionsPerHour !== undefined
        ? form.maxActionsPerHour
        : config.maxActionsPerHour,
    maxActionsPerDay:
      form.maxActionsPerDay !== undefined ? form.maxActionsPerDay : config.maxActionsPerDay,
    cooldownMin: form.cooldownMin !== undefined ? form.cooldownMin : config.cooldownMin,
    autoResume: form.autoResume !== undefined ? form.autoResume : config.autoResume,
  };

  // Status indicator
  let statusLabel: string;
  let StatusIcon: typeof ShieldCheck;
  let statusClass: string;

  if (isKillActive) {
    statusLabel = "Kill-switch ativo";
    StatusIcon = ShieldX;
    statusClass = "text-red-600 dark:text-red-400";
  } else if (isTripped) {
    statusLabel = "Circuit-breaker disparado";
    StatusIcon = ShieldAlert;
    statusClass = "text-yellow-600 dark:text-yellow-400";
  } else {
    statusLabel = "Operando normalmente";
    StatusIcon = ShieldCheck;
    statusClass = "text-green-600 dark:text-green-400";
  }

  const hourPct = Math.min(
    100,
    Math.round((state.actionsThisHour / config.maxActionsPerHour) * 100),
  );
  const dayPct = Math.min(
    100,
    Math.round((state.actionsToday / config.maxActionsPerDay) * 100),
  );
  const failPct = Math.min(
    100,
    Math.round((state.consecutiveFails / config.maxConsecutiveFails) * 100),
  );

  return (
    <div className="space-y-6">
      {/* Status + kill-switch button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <StatusIcon className={`size-5 ${statusClass}`} />
          <span className={`text-sm font-medium ${statusClass}`}>{statusLabel}</span>
          {isKillActive && (
            <Badge variant="destructive" className="text-xs">PARADO</Badge>
          )}
          {isTripped && !isKillActive && (
            <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
              PAUSADO
            </Badge>
          )}
        </div>

        <div className="flex gap-2">
          {isKillActive || isTripped ? (
            <Button
              size="sm"
              variant="default"
              onClick={() => resumeMutation.mutate()}
              disabled={resumeMutation.isPending}
            >
              <Play className="mr-1 size-4" />
              Reativar Agente
            </Button>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={killMutation.isPending}>
                  <Zap className="mr-1 size-4" />
                  Parar Agente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ativar kill-switch?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso vai interromper imediatamente todas as execuções autônomas deste agente
                    (heartbeat, cron e webhooks). A parada é efetiva em menos de 1 segundo.
                    <br />
                    <br />
                    Para retomar, clique em "Reativar Agente".
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => killMutation.mutate()}
                  >
                    Parar Agente
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Counters */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Contadores em tempo real</h3>
        <div className="rounded-lg border divide-y">
          {/* Consecutive fails */}
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Falhas consecutivas</span>
              <span className="font-medium tabular-nums">
                {state.consecutiveFails} / {config.maxConsecutiveFails}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${failPct >= 100 ? "bg-red-500" : failPct >= 70 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${failPct}%` }}
              />
            </div>
          </div>

          {/* Actions this hour */}
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ações / hora</span>
              <span className="font-medium tabular-nums">
                {state.actionsThisHour} / {config.maxActionsPerHour}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${hourPct >= 100 ? "bg-red-500" : hourPct >= 80 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${hourPct}%` }}
              />
            </div>
          </div>

          {/* Actions today */}
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ações / dia</span>
              <span className="font-medium tabular-nums">
                {state.actionsToday} / {config.maxActionsPerDay}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${dayPct >= 100 ? "bg-red-500" : dayPct >= 80 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${dayPct}%` }}
              />
            </div>
          </div>

          {/* Trip timing */}
          {isTripped && (
            <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Disparado em</p>
                <p className="font-medium">{formatDate(state.trippedAt)}</p>
              </div>
              {state.resumeAt && (
                <div>
                  <p className="text-muted-foreground">Retomada automática</p>
                  <p className="font-medium">{formatDate(state.resumeAt)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Config form */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Configuração</h3>
        <div className="rounded-lg border divide-y">
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Circuit-breaker habilitado</Label>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(v) => setField("enabled", v)}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Max falhas consecutivas</Label>
            <Input
              type="number"
              min={1}
              className="h-8 w-28"
              value={cfg.maxConsecutiveFails}
              onChange={(e) => setField("maxConsecutiveFails", Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Threshold de error rate (0–1)</Label>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="h-8 w-28"
              value={cfg.errorRateThreshold}
              onChange={(e) => setField("errorRateThreshold", Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Janela de error rate (min)</Label>
            <Input
              type="number"
              min={1}
              className="h-8 w-28"
              value={cfg.errorRateWindowMin}
              onChange={(e) => setField("errorRateWindowMin", Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Max ações / hora</Label>
            <Input
              type="number"
              min={1}
              className="h-8 w-28"
              value={cfg.maxActionsPerHour}
              onChange={(e) => setField("maxActionsPerHour", Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Max ações / dia</Label>
            <Input
              type="number"
              min={1}
              className="h-8 w-28"
              value={cfg.maxActionsPerDay}
              onChange={(e) => setField("maxActionsPerDay", Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Cooldown (min)</Label>
            <Input
              type="number"
              min={1}
              className="h-8 w-28"
              value={cfg.cooldownMin}
              onChange={(e) => setField("cooldownMin", Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Retomada automática após cooldown</Label>
            <Switch
              checked={cfg.autoResume}
              onCheckedChange={(v) => setField("autoResume", v)}
            />
          </div>
        </div>

        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          <Save className="mr-1 size-4" />
          Salvar configuração
        </Button>
      </div>

      {/* Events table */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Últimos eventos</h3>
        {eventsLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : !events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Evento</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Motivo</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ator</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Badge variant={eventTypeBadgeVariant(ev.eventType)} className="text-xs">
                        {eventTypeLabel(ev.eventType)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground max-w-[180px] truncate">
                      {ev.triggerReason ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{ev.actor ?? "sistema"}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {formatDate(ev.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

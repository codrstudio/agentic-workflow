import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  routingConfigQueryOptions,
  updateRoutingConfig,
} from "@/api/settings";
import type { RoutingRule } from "@/api/settings";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { RoutingRulesList } from "./routing-rules-list.js";
import { RoutingSimulatePanel } from "./routing-simulate-panel.js";

export function RoutingSettings() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useQuery(routingConfigQueryOptions());

  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [rules, setRules] = useState<RoutingRule[] | null>(null);

  const effectiveEnabled = enabled ?? config?.enabled ?? false;
  const effectiveRules = rules ?? config?.rules ?? [];

  const isDirty =
    (enabled !== null && enabled !== config?.enabled) ||
    (rules !== null && JSON.stringify(rules) !== JSON.stringify(config?.rules));

  const mutation = useMutation({
    mutationFn: () =>
      updateRoutingConfig({ enabled: effectiveEnabled, rules: effectiveRules }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "routing"] });
      setEnabled(null);
      setRules(null);
      toast.success("Configuracao de routing salva");
    },
    onError: () => toast.error("Erro ao salvar configuracao de routing"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label className="text-sm font-medium">Habilitar routing automatico</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Seleciona o modelo LLM dinamicamente com base nas regras abaixo.
          </p>
        </div>
        <Switch
          checked={effectiveEnabled}
          onCheckedChange={(v) => setEnabled(v)}
        />
      </div>

      {/* Rules */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Regras Globais</h3>
          <p className="text-xs text-muted-foreground">
            Aplicadas a todos os agentes. Regras do agente tem prioridade maior.
          </p>
        </div>
        <RoutingRulesList
          rules={effectiveRules}
          onChange={(r) => setRules(r)}
          disabled={!effectiveEnabled}
        />
      </div>

      {/* Save */}
      {isDirty && (
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando..." : "Salvar Alteracoes"}
        </Button>
      )}

      <Separator />

      {/* Simulate */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Simular Routing</h3>
          <p className="text-xs text-muted-foreground">
            Teste qual modelo seria selecionado para um contexto especifico.
          </p>
        </div>
        <RoutingSimulatePanel />
      </div>
    </div>
  );
}

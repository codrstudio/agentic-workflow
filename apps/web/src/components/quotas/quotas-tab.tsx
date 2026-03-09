import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { quotaQueryOptions, updateQuota, resetQuota } from "@/api/quotas";
import type { UpdateQuotaBody } from "@/api/quotas";
import { QuotaGauge } from "@/components/quotas/quota-gauge";
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

interface QuotasTabProps {
  agentId: string;
}

export function QuotasTab({ agentId }: QuotasTabProps) {
  const queryClient = useQueryClient();
  const { data: quota, isLoading } = useQuery(quotaQueryOptions(agentId));

  const [form, setForm] = useState<UpdateQuotaBody>({});
  const [dirty, setDirty] = useState(false);

  function setField<K extends keyof UpdateQuotaBody>(key: K, value: UpdateQuotaBody[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => updateQuota(agentId, form),
    onSuccess: () => {
      toast.success("Configuracao salva");
      queryClient.invalidateQueries({ queryKey: ["quota", agentId] });
      setDirty(false);
    },
    onError: () => toast.error("Erro ao salvar configuracao"),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetQuota(agentId),
    onSuccess: () => {
      toast.success("Janela de consumo resetada");
      queryClient.invalidateQueries({ queryKey: ["quota", agentId] });
    },
    onError: () => toast.error("Erro ao resetar janela"),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!quota) {
    return <p className="text-muted-foreground text-sm">Nao foi possivel carregar as quotas.</p>;
  }

  const { config, usage, status } = quota;

  const tokensUsed = usage.hourly.tokensUsed ?? 0;
  const heartbeats = usage.daily.heartbeats ?? 0;

  const configValues = {
    maxTokensPerHour: form.maxTokensPerHour !== undefined ? form.maxTokensPerHour : config.maxTokensPerHour,
    maxHeartbeatsDay: form.maxHeartbeatsDay !== undefined ? form.maxHeartbeatsDay : config.maxHeartbeatsDay,
    maxToolTimeoutMs: form.maxToolTimeoutMs !== undefined ? form.maxToolTimeoutMs : config.maxToolTimeoutMs,
    pauseOnExceed: form.pauseOnExceed !== undefined ? form.pauseOnExceed : config.pauseOnExceed,
  };

  return (
    <div className="space-y-6">
      {/* Status badge + gauges */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">Consumo atual</h3>
          <Badge variant={status === "paused_quota" ? "destructive" : "default"}>
            {status === "paused_quota" ? "Pausado por quota" : "Ativo"}
          </Badge>
        </div>

        <div className="flex gap-8 flex-wrap">
          <QuotaGauge
            label="Tokens / hora"
            used={tokensUsed}
            total={config.maxTokensPerHour}
            pctUsed={usage.hourly.pctUsed}
          />
          <QuotaGauge
            label="Heartbeats / dia"
            used={heartbeats}
            total={config.maxHeartbeatsDay}
            pctUsed={usage.daily.pctUsed}
          />
        </div>
      </div>

      {/* Config table */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Configuracao</h3>
        <div className="rounded-lg border divide-y">
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Max tokens / hora</Label>
            <Input
              type="number"
              min={0}
              placeholder="sem limite"
              className="h-8 w-36"
              value={configValues.maxTokensPerHour ?? ""}
              onChange={(e) =>
                setField("maxTokensPerHour", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Max heartbeats / dia</Label>
            <Input
              type="number"
              min={0}
              placeholder="sem limite"
              className="h-8 w-36"
              value={configValues.maxHeartbeatsDay ?? ""}
              onChange={(e) =>
                setField("maxHeartbeatsDay", e.target.value ? Number(e.target.value) : null)
              }
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Timeout de tool call (ms)</Label>
            <Input
              type="number"
              min={1000}
              step={1000}
              className="h-8 w-36"
              value={configValues.maxToolTimeoutMs ?? 30000}
              onChange={(e) => setField("maxToolTimeoutMs", Number(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-2 items-center px-4 py-3">
            <Label className="text-sm">Pausar ao exceder quota</Label>
            <Switch
              checked={configValues.pauseOnExceed}
              onCheckedChange={(v) => setField("pauseOnExceed", v)}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
        >
          <Save className="mr-1 size-4" />
          Salvar configuracao
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={resetMutation.isPending}>
              <RotateCcw className="mr-1 size-4" />
              Resetar janela atual
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resetar janela de consumo?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso vai zerar os contadores de tokens e heartbeats da janela atual.
                O agente voltara a executar normalmente se estiver pausado por quota.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => resetMutation.mutate()}>
                Resetar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

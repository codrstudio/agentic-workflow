import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  createBudgetAlert,
  updateBudgetAlert,
  type BudgetAlert,
} from "@/api/costs";
import { agentsQueryOptions } from "@/api/agents";
import { ApiError } from "@/lib/api";
import { toast } from "sonner";

interface BudgetAlertFormProps {
  alert?: BudgetAlert;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BudgetAlertForm({
  alert,
  open,
  onOpenChange,
}: BudgetAlertFormProps) {
  const isEditing = !!alert;
  const queryClient = useQueryClient();

  const [scope, setScope] = useState(alert?.scope ?? "global");
  const [threshold, setThreshold] = useState(
    alert?.threshold?.toString() ?? "",
  );
  const [period, setPeriod] = useState<string>(alert?.period ?? "monthly");

  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [backendError, setBackendError] = useState<string | null>(null);

  const { data: agents } = useQuery(agentsQueryOptions());

  function handleSuccess() {
    queryClient.invalidateQueries({ queryKey: ["budget-alerts"] });
    toast.success(
      isEditing ? "Alerta atualizado com sucesso" : "Alerta criado com sucesso",
    );
    onOpenChange(false);
  }

  function handleError(error: unknown) {
    if (error instanceof ApiError) {
      const body = error.body as Record<string, unknown> | undefined;
      setBackendError(
        (body?.error as string) ?? "Erro ao salvar alerta",
      );
    } else {
      setBackendError("Erro ao salvar alerta");
    }
  }

  const createMutation = useMutation({
    mutationFn: createBudgetAlert,
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: number } & Parameters<typeof updateBudgetAlert>[1]) =>
      updateBudgetAlert(id, data),
    onSuccess: handleSuccess,
    onError: handleError,
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function validate(): boolean {
    const val = parseFloat(threshold);
    if (!threshold.trim() || isNaN(val) || val <= 0) {
      setThresholdError("Informe um valor maior que zero");
      return false;
    }
    setThresholdError(null);
    return true;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBackendError(null);
    if (!validate()) return;

    const data = {
      scope,
      threshold: parseFloat(threshold),
      period,
    };

    if (isEditing) {
      updateMutation.mutate({ id: alert.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Alerta" : "Novo Alerta"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere as configuracoes do alerta de orcamento."
              : "Configure um alerta para monitorar gastos."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Escopo</Label>
            <Select value={scope} onValueChange={(v) => { if (v) setScope(v); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o escopo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Global</SelectItem>
                {(agents ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget-threshold">Limite (USD)</Label>
            <Input
              id="budget-threshold"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="10.00"
              value={threshold}
              onChange={(e) => {
                setThreshold(e.target.value);
                setThresholdError(null);
              }}
              aria-invalid={!!thresholdError}
            />
            {thresholdError && (
              <p className="text-sm text-destructive">{thresholdError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Periodo</Label>
            <Select value={period} onValueChange={(v) => { if (v) setPeriod(v); }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Diario</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {backendError && (
            <p className="text-sm text-destructive">{backendError}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending
                ? isEditing
                  ? "Salvando..."
                  : "Criando..."
                : isEditing
                  ? "Salvar"
                  : "Criar Alerta"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

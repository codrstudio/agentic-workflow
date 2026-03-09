import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  budgetAlertsQueryOptions,
  updateBudgetAlert,
  deleteBudgetAlert,
  type BudgetAlert,
} from "@/api/costs";
import { BudgetAlertForm } from "@/components/costs/budget-alert-form";

const periodLabels: Record<string, string> = {
  daily: "Diario",
  weekly: "Semanal",
  monthly: "Mensal",
};

export function BudgetAlertList() {
  const queryClient = useQueryClient();
  const { data: alerts, isLoading } = useQuery(budgetAlertsQueryOptions());

  const [formOpen, setFormOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<BudgetAlert | undefined>();

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      updateBudgetAlert(id, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-alerts"] });
    },
    onError: () => {
      toast.error("Erro ao alterar status do alerta");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBudgetAlert,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["budget-alerts"] });
      toast.success("Alerta removido");
    },
    onError: () => {
      toast.error("Erro ao remover alerta");
    },
  });

  function openCreate() {
    setEditingAlert(undefined);
    setFormOpen(true);
  }

  function openEdit(alert: BudgetAlert) {
    setEditingAlert(alert);
    setFormOpen(true);
  }

  function handleDelete(id: number) {
    deleteMutation.mutate(id);
  }

  function handleToggle(alert: BudgetAlert) {
    toggleMutation.mutate({ id: alert.id, enabled: !alert.enabled });
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Alertas de Orcamento</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 size-4" />
          Novo Alerta
        </Button>
      </div>

      {!alerts?.length ? (
        <EmptyState
          icon={<BellRing />}
          title="Nenhum alerta configurado"
          description="Crie alertas para monitorar gastos e receber notificacoes automaticas."
        />
      ) : (
        <>
          {/* Desktop: Table */}
          <div className="hidden rounded-lg border sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Periodo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell className="font-medium">
                      {alert.scope === "global" ? (
                        <Badge variant="secondary">Global</Badge>
                      ) : (
                        <code className="text-sm">{alert.scope}</code>
                      )}
                    </TableCell>
                    <TableCell>${alert.threshold.toFixed(2)}</TableCell>
                    <TableCell>
                      {periodLabels[alert.period] ?? alert.period}
                    </TableCell>
                    <TableCell>
                      <Switch
                        size="sm"
                        checked={alert.enabled}
                        onCheckedChange={() => handleToggle(alert)}
                        aria-label={
                          alert.enabled ? "Desativar alerta" : "Ativar alerta"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => openEdit(alert)}
                          aria-label="Editar alerta"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(alert.id)}
                          aria-label="Excluir alerta"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: Cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="rounded-lg border p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {alert.scope === "global" ? (
                      <Badge variant="secondary">Global</Badge>
                    ) : (
                      <code className="text-sm">{alert.scope}</code>
                    )}
                  </div>
                  <Switch
                    size="sm"
                    checked={alert.enabled}
                    onCheckedChange={() => handleToggle(alert)}
                    aria-label={
                      alert.enabled ? "Desativar alerta" : "Ativar alerta"
                    }
                  />
                </div>

                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground">Limite:</span>{" "}
                    <span className="font-medium">
                      ${alert.threshold.toFixed(2)}
                    </span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">Periodo:</span>{" "}
                    {periodLabels[alert.period] ?? alert.period}
                  </span>
                </div>

                <div className="mt-3 flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(alert)}
                  >
                    <Pencil className="mr-1 size-3.5" />
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(alert.id)}
                  >
                    <Trash2 className="mr-1 size-3.5" />
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <BudgetAlertForm
        key={editingAlert?.id ?? "__create__"}
        alert={editingAlert}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { securityRulesQueryOptions, type SecurityRule } from "@/api/security";
import { request } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SecurityRuleDialog } from "./security-rule-dialog";

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  low: "secondary",
  medium: "outline",
  high: "destructive",
  critical: "destructive",
};

export function SecurityRulesTab() {
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading } = useQuery(securityRulesQueryOptions());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());

  async function handleToggle(rule: SecurityRule) {
    setTogglingIds((s) => new Set(s).add(rule.id));
    try {
      await request(`/security/rules/${rule.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: rule.enabled ? 0 : 1 }),
      });
      await queryClient.invalidateQueries({ queryKey: ["security", "rules"] });
    } finally {
      setTogglingIds((s) => {
        const next = new Set(s);
        next.delete(rule.id);
        return next;
      });
    }
  }

  async function handleDelete(rule: SecurityRule) {
    if (!confirm(`Remover regra "${rule.name}"?`)) return;
    setDeletingIds((s) => new Set(s).add(rule.id));
    try {
      await request(`/security/rules/${rule.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: ["security", "rules"] });
    } finally {
      setDeletingIds((s) => {
        const next = new Set(s);
        next.delete(rule.id);
        return next;
      });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Acao</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell>
                  <div>
                    <p className="text-sm font-medium">{rule.name}</p>
                    {rule.description && (
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-xs">{rule.rule_type}</TableCell>
                <TableCell>
                  <Badge variant={SEVERITY_VARIANT[rule.severity] ?? "outline"}>
                    {rule.severity}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={rule.action === "blocked" ? "destructive" : "outline"}>
                    {rule.action === "blocked" ? "Bloquear" : "Sinalizar"}
                  </Badge>
                </TableCell>
                <TableCell>
                  {rule.is_system ? (
                    <Badge variant="secondary">Sistema</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">Customizada</span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={!!rule.enabled}
                    onCheckedChange={() => handleToggle(rule)}
                    disabled={togglingIds.has(rule.id)}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={!!rule.is_system || deletingIds.has(rule.id)}
                    onClick={() => handleDelete(rule)}
                    title={rule.is_system ? "Regras de sistema nao podem ser removidas" : "Remover regra"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <SecurityRuleDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}

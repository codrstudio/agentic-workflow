import { ShieldX, AlertTriangle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SecuritySummary } from "@/api/security";

interface SecuritySummaryCardsProps {
  summary: SecuritySummary;
}

export function SecuritySummaryCards({ summary }: SecuritySummaryCardsProps) {
  const blocked = summary.byAction.find((a) => a.action === "blocked")?.count ?? 0;
  const flagged = summary.byAction.find((a) => a.action === "flagged")?.count ?? 0;
  const total = summary.totalEvents;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Bloqueados</CardTitle>
          <ShieldX className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{blocked}</p>
          <p className="text-xs text-muted-foreground">mensagens bloqueadas</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Suspeitos</CardTitle>
          <AlertTriangle className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{flagged}</p>
          <p className="text-xs text-muted-foreground">eventos sinalizados</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-xs text-muted-foreground">eventos de seguranca</p>
        </CardContent>
      </Card>
    </div>
  );
}

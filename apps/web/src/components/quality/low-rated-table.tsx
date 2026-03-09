import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { LowRatedItem } from "@/api/quality";
import { ExportToGoldenSetModal } from "@/components/quality/export-to-golden-set-modal";

const REASON_LABELS: Record<string, string> = {
  resposta_incorreta: "Resposta incorreta",
  sem_contexto: "Sem contexto",
  incompleta: "Incompleta",
  tom_inadequado: "Tom inadequado",
  outro: "Outro",
};

interface LowRatedTableProps {
  agentId: string;
  items: LowRatedItem[];
  isLoading: boolean;
}

function truncate(text: string, max = 80) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export function LowRatedTable({ agentId, items, isLoading }: LowRatedTableProps) {
  const [exportItem, setExportItem] = useState<LowRatedItem | null>(null);

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Mensagens Mal-Avaliadas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma avaliacao negativa no periodo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Saida</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead className="whitespace-nowrap">Data</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="text-xs max-w-[180px]">
                        {truncate(item.input)}
                      </TableCell>
                      <TableCell className="text-xs max-w-[220px]">
                        {truncate(item.output)}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">
                        {item.reason ? (REASON_LABELS[item.reason] ?? item.reason) : "—"}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="whitespace-nowrap text-xs"
                          onClick={() => setExportItem(item)}
                        >
                          Exportar para Golden Set
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {exportItem && (
        <ExportToGoldenSetModal
          open={!!exportItem}
          onOpenChange={(open) => { if (!open) setExportItem(null); }}
          agentId={agentId}
          item={exportItem}
        />
      )}
    </>
  );
}

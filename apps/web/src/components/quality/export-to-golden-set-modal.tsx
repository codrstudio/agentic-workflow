import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { evalSetsQueryOptions } from "@/api/evaluation";
import { request } from "@/lib/api";
import type { LowRatedItem } from "@/api/quality";

interface ExportToGoldenSetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  item: LowRatedItem;
}

export function ExportToGoldenSetModal({
  open,
  onOpenChange,
  agentId,
  item,
}: ExportToGoldenSetModalProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [newSetName, setNewSetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: evalSets, isLoading: setsLoading } = useQuery(
    evalSetsQueryOptions(agentId),
  );

  async function handleExport() {
    setError(null);
    setLoading(true);
    try {
      let setId: number;

      if (mode === "new") {
        if (!newSetName.trim()) {
          setError("Informe um nome para o eval set.");
          setLoading(false);
          return;
        }
        const created = await request<{ id: number }>(
          `/agents/${agentId}/eval-sets`,
          {
            method: "POST",
            body: JSON.stringify({ name: newSetName.trim() }),
          },
        );
        setId = created.id;
        queryClient.invalidateQueries({ queryKey: ["eval-sets", agentId] });
      } else {
        if (!selectedSetId) {
          setError("Selecione um eval set.");
          setLoading(false);
          return;
        }
        setId = Number(selectedSetId);
      }

      await request(`/agents/${agentId}/eval-sets/${setId}/cases`, {
        method: "POST",
        body: JSON.stringify({ input: item.input, expected: "" }),
      });

      onOpenChange(false);
      navigate({
        to: "/agents/$id",
        params: { id: agentId },
        search: { tab: "evaluation" as never },
      });
    } catch {
      setError("Erro ao exportar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar para Golden Set</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="text-sm text-muted-foreground border rounded-md p-3 bg-muted/30">
            <span className="font-medium">Entrada:</span>{" "}
            {item.input.length > 120 ? item.input.slice(0, 120) + "…" : item.input}
          </div>

          <RadioGroup
            value={mode}
            onValueChange={(v) => setMode(v as "existing" | "new")}
            className="gap-3"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="existing" id="mode-existing" />
              <Label htmlFor="mode-existing">Usar eval set existente</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="new" id="mode-new" />
              <Label htmlFor="mode-new">Criar novo eval set</Label>
            </div>
          </RadioGroup>

          {mode === "existing" && (
            <div className="space-y-2">
              {setsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : !evalSets || evalSets.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum eval set encontrado. Crie um novo.
                </p>
              ) : (
                <RadioGroup
                  value={selectedSetId}
                  onValueChange={setSelectedSetId}
                  className="gap-2"
                >
                  {evalSets.map((es) => (
                    <div
                      key={es.id}
                      className="flex items-center gap-2 border rounded-md px-3 py-2"
                    >
                      <RadioGroupItem
                        value={String(es.id)}
                        id={`set-${es.id}`}
                      />
                      <Label htmlFor={`set-${es.id}`} className="cursor-pointer flex-1">
                        <span className="font-medium">{es.name}</span>
                        {es.cases && (
                          <span className="text-muted-foreground ml-2 text-xs">
                            ({es.cases.length} caso{es.cases.length !== 1 ? "s" : ""})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>
          )}

          {mode === "new" && (
            <div className="space-y-1">
              <Label htmlFor="new-set-name">Nome do eval set</Label>
              <Input
                id="new-set-name"
                placeholder="Ex: Casos críticos março 2026"
                value={newSetName}
                onChange={(e) => setNewSetName(e.target.value)}
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? "Exportando…" : "Exportar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { request } from "@/lib/api";
import type { EvalSet, EvalCase } from "@/api/evaluation";

interface PendingCase {
  id: string;
  input: string;
  expected: string;
  tags: string;
}

interface EvalSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  editingSet?: EvalSet | null;
}

export function EvalSetDialog({
  open,
  onOpenChange,
  agentId,
  editingSet,
}: EvalSetDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = !!editingSet;

  const [name, setName] = useState(editingSet?.name ?? "");
  const [description, setDescription] = useState(editingSet?.description ?? "");
  const [cases, setCases] = useState<PendingCase[]>(
    editingSet?.cases?.map((c) => ({
      id: String(c.id),
      input: c.input,
      expected: c.expected,
      tags: c.tags ?? "",
    })) ?? [],
  );

  function resetForm() {
    setName("");
    setDescription("");
    setCases([]);
  }

  function addCase() {
    setCases((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, input: "", expected: "", tags: "" },
    ]);
  }

  function removeCase(id: string) {
    setCases((prev) => prev.filter((c) => c.id !== id));
  }

  function updateCase(id: string, field: keyof Omit<PendingCase, "id">, value: string) {
    setCases((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEditing && editingSet) {
        await request(`/agents/${agentId}/eval-sets/${editingSet.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, description }),
        });
        // sync cases: add new ones (those with non-numeric id)
        for (const c of cases) {
          if (c.id.startsWith("new-")) {
            await request(`/agents/${agentId}/eval-sets/${editingSet.id}/cases`, {
              method: "POST",
              body: JSON.stringify({ input: c.input, expected: c.expected, tags: c.tags }),
            });
          }
        }
      } else {
        const set = await request<EvalSet>(`/agents/${agentId}/eval-sets`, {
          method: "POST",
          body: JSON.stringify({ name, description }),
        });
        for (const c of cases) {
          await request(`/agents/${agentId}/eval-sets/${set.id}/cases`, {
            method: "POST",
            body: JSON.stringify({ input: c.input, expected: c.expected, tags: c.tags }),
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eval-sets", agentId] });
      toast.success(isEditing ? "Set atualizado" : "Set criado");
      resetForm();
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar set"),
  });

  function handleOpenChange(open: boolean) {
    if (!open) resetForm();
    onOpenChange(open);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar Set" : "Novo Set de Avaliacao"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="set-name">Nome</Label>
            <Input
              id="set-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Casos basicos de atendimento"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-desc">Descricao</Label>
            <Textarea
              id="set-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Casos</Label>
              <Button size="sm" variant="outline" onClick={addCase}>
                <Plus className="mr-1 size-3.5" />
                Adicionar caso
              </Button>
            </div>

            {cases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                Nenhum caso adicionado.
              </p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entrada</TableHead>
                      <TableHead>Esperado</TableHead>
                      <TableHead>Tags</TableHead>
                      <TableHead className="w-[40px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cases.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Input
                            value={c.input}
                            onChange={(e) => updateCase(c.id, "input", e.target.value)}
                            placeholder="Mensagem de entrada"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={c.expected}
                            onChange={(e) => updateCase(c.id, "expected", e.target.value)}
                            placeholder="Resposta esperada"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={c.tags}
                            onChange={(e) => updateCase(c.id, "tags", e.target.value)}
                            placeholder="tag1,tag2"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive"
                            onClick={() => removeCase(c.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!name.trim() || saveMutation.isPending}
          >
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createHandoff } from "@/api/handoffs";
import { agentsQueryOptions } from "@/api/agents";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HandoffCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
}

export function HandoffCreateDialog({
  open,
  onOpenChange,
  agentId,
}: HandoffCreateDialogProps) {
  const queryClient = useQueryClient();
  const { data: agents } = useQuery(agentsQueryOptions());

  const [memberId, setMemberId] = useState("");
  const [label, setLabel] = useState("");
  const [triggerIntent, setTriggerIntent] = useState("");
  const [priority, setPriority] = useState("0");

  const availableAgents = (agents ?? []).filter((a) => a.id !== agentId);

  function reset() {
    setMemberId("");
    setLabel("");
    setTriggerIntent("");
    setPriority("0");
  }

  const createMutation = useMutation({
    mutationFn: () =>
      createHandoff(agentId, {
        memberId,
        label,
        triggerIntent,
        priority: parseInt(priority, 10) || 0,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoffs", agentId] });
      toast.success("Handoff criado");
      reset();
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao criar handoff"),
  });

  const isValid = memberId && label.trim() && triggerIntent.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Handoff</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hc-member">Agente membro *</Label>
            <Select value={memberId} onValueChange={(v) => v && setMemberId(v)}>
              <SelectTrigger id="hc-member">
                <SelectValue placeholder="Selecione um agente" />
              </SelectTrigger>
              <SelectContent>
                {availableAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hc-label">Label *</Label>
            <Input
              id="hc-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ex: Suporte Tecnico"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hc-intent">Intencao que dispara esta delegacao *</Label>
            <Textarea
              id="hc-intent"
              value={triggerIntent}
              onChange={(e) => setTriggerIntent(e.target.value)}
              rows={3}
              placeholder="Ex: problemas tecnicos, erros, bugs, dificuldades de acesso"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="hc-priority">Prioridade</Label>
            <Input
              id="hc-priority"
              type="number"
              min={0}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Menor numero = maior prioridade. 0 e o mais prioritario.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!isValid || createMutation.isPending}
          >
            {createMutation.isPending ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

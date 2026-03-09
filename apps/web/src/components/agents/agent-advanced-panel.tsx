import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Copy, Trash2 } from "lucide-react";
import { duplicateAgent, deleteAgent } from "@/api/agents";
import type { Agent } from "@/api/agents";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AgentAdvancedPanelProps {
  agent: Agent;
}

export function AgentAdvancedPanel({ agent }: AgentAdvancedPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmSlug, setConfirmSlug] = useState("");

  const duplicateMutation = useMutation({
    mutationFn: () => duplicateAgent(agent.id),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      navigate({
        to: "/agents/$id",
        params: { id: newAgent.id },
        search: { tab: "config" },
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAgent(agent.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      navigate({ to: "/agents" });
    },
  });

  const canDelete = confirmSlug === agent.slug;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Avancado</h3>
        <p className="text-sm text-muted-foreground">
          Acoes avancadas para este agente.
        </p>
      </div>

      {/* Duplicar */}
      <div className="rounded-lg border p-4 space-y-3">
        <div>
          <h4 className="text-sm font-medium">Duplicar Agente</h4>
          <p className="text-sm text-muted-foreground">
            Cria uma copia deste agente com um novo slug.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => duplicateMutation.mutate()}
          disabled={duplicateMutation.isPending}
        >
          <Copy className="size-4" />
          {duplicateMutation.isPending ? "Duplicando..." : "Duplicar Agente"}
        </Button>
        {duplicateMutation.isError && (
          <p className="text-sm text-destructive">
            Erro ao duplicar agente. Tente novamente.
          </p>
        )}
      </div>

      {/* Zona Perigosa */}
      <div className="rounded-lg border border-destructive/50 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <h4 className="text-sm font-medium text-destructive">
            Zona Perigosa
          </h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Esta acao e irreversivel. O agente e todos os seus dados serao
          removidos permanentemente.
        </p>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="size-4" />
          Excluir Agente
        </Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setConfirmSlug("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Agente</DialogTitle>
            <DialogDescription>
              Esta acao e irreversivel. O agente{" "}
              <span className="font-semibold text-foreground">
                {agent.slug}
              </span>{" "}
              e todos os seus dados serao removidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-slug">
              Digite <span className="font-semibold">{agent.slug}</span> para
              confirmar:
            </Label>
            <Input
              id="confirm-slug"
              value={confirmSlug}
              onChange={(e) => setConfirmSlug(e.target.value)}
              placeholder={agent.slug}
              autoComplete="off"
            />
          </div>
          {deleteMutation.isError && (
            <p className="text-sm text-destructive">
              Erro ao excluir agente. Tente novamente.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setConfirmSlug("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!canDelete || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir Agente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

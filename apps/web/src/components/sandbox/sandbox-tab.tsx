import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { PlusCircle, Pencil, GitCompare, Rocket, Trash2 } from "lucide-react";
import {
  draftsQueryOptions,
  createDraft,
  deleteDraft,
  publishDraft,
} from "@/api/drafts";
import type { Draft } from "@/api/drafts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface SandboxTabProps {
  agentId: string;
}

export function SandboxTab({ agentId }: SandboxTabProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: drafts, isLoading } = useQuery(draftsQueryOptions(agentId));

  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [publishTarget, setPublishTarget] = useState<Draft | null>(null);
  const [discardTarget, setDiscardTarget] = useState<Draft | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  async function handleCreate() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      await createDraft(agentId, newLabel.trim());
      setNewLabel("");
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["drafts", agentId] });
    } finally {
      setCreating(false);
    }
  }

  async function handlePublish() {
    if (!publishTarget) return;
    setPublishing(true);
    try {
      await publishDraft(agentId, publishTarget.id);
      queryClient.invalidateQueries({ queryKey: ["drafts", agentId] });
      setPublishTarget(null);
    } finally {
      setPublishing(false);
    }
  }

  async function handleDiscard() {
    if (!discardTarget) return;
    setDiscarding(true);
    try {
      await deleteDraft(agentId, discardTarget.id);
      queryClient.invalidateQueries({ queryKey: ["drafts", agentId] });
      setDiscardTarget(null);
    } finally {
      setDiscarding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Rascunhos</h3>
        <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
          <PlusCircle className="size-4 mr-1" />
          Criar rascunho
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!isLoading && (!drafts || drafts.length === 0) && (
        <p className="text-sm text-muted-foreground">
          Nenhum rascunho encontrado. Crie um para comecar.
        </p>
      )}

      {drafts && drafts.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-2 font-medium">Label</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">
                  Criado em
                </th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">
                  Atualizado em
                </th>
                <th className="text-right px-4 py-2 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {drafts.map((draft) => (
                <tr
                  key={draft.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-2 font-medium">{draft.label}</td>
                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                    {new Date(draft.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                    {new Date(draft.updatedAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigate({
                            to: "/agents/$id/drafts/$draftId",
                            params: { id: agentId, draftId: draft.id },
                          })
                        }
                      >
                        <Pencil className="size-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          navigate({
                            to: "/agents/$id/drafts/$draftId/compare",
                            params: { id: agentId, draftId: draft.id },
                          })
                        }
                      >
                        <GitCompare className="size-3.5 mr-1" />
                        Comparar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPublishTarget(draft)}
                      >
                        <Rocket className="size-3.5 mr-1" />
                        Publicar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDiscardTarget(draft)}
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Descartar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create draft dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo rascunho</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Label</label>
            <Input
              placeholder="Ex: Teste novo tom de voz"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newLabel.trim()}>
              {creating ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish confirmation dialog */}
      <Dialog open={!!publishTarget} onOpenChange={(o) => { if (!o) setPublishTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar rascunho</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Isso sobrescreve a producao com o rascunho{" "}
            <strong>{publishTarget?.label}</strong>. O estado atual sera salvo
            como nova versao antes de ser substituido.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publicando..." : "Publicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discard confirmation dialog */}
      <Dialog open={!!discardTarget} onOpenChange={(o) => { if (!o) setDiscardTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar rascunho</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja descartar o rascunho{" "}
            <strong>{discardTarget?.label}</strong>? Esta acao e irreversivel.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDiscard}
              disabled={discarding}
            >
              {discarding ? "Descartando..." : "Descartar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

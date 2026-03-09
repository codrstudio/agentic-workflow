import { UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";

interface TakeoverButtonProps {
  sessionId: string;
  onTakeover: () => void;
  isPending?: boolean;
}

export function TakeoverButton({ onTakeover, isPending }: TakeoverButtonProps) {
  const [open, setOpen] = useState(false);

  function handleConfirm() {
    setOpen(false);
    onTakeover();
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        <UserCheck className="mr-1.5 size-4" />
        Assumir conversa
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assumir conversa</DialogTitle>
            <DialogDescription>
              O agente parara de responder. Voce assumira o controle e respondera
              diretamente ao usuario. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              Assumir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useState, useEffect } from "react";
import { Bot, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TakeoverBannerProps {
  takenOverBy: string;
  takenOverAt: string;
  onRelease: () => void;
  isPending?: boolean;
}

function formatElapsed(startIso: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}min`;
}

export function TakeoverBanner({
  takenOverBy,
  takenOverAt,
  onRelease,
  isPending,
}: TakeoverBannerProps) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(takenOverAt));
  const [releaseOpen, setReleaseOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatElapsed(takenOverAt));
    }, 10000);
    return () => clearInterval(timer);
  }, [takenOverAt]);

  function handleConfirm() {
    setReleaseOpen(false);
    onRelease();
  }

  return (
    <>
      <div className="flex items-center gap-2 border-b bg-primary/10 px-4 py-2 text-sm">
        <UserCheck className="size-4 shrink-0 text-primary" />
        <span className="flex-1 text-foreground">
          <span className="font-medium text-primary">{takenOverBy}</span>
          {" assumiu esta conversa ha "}
          <span className="font-medium">{elapsed}</span>
        </span>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setReleaseOpen(true)}
          disabled={isPending}
        >
          <Bot className="mr-1.5 size-4" />
          Devolver ao agente
        </Button>
      </div>

      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver ao agente</DialogTitle>
            <DialogDescription>
              O agente voltara a responder automaticamente. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={isPending}>
              Devolver
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import type { VersionMeta } from "@/api/versions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface RollbackDialogProps {
  fileName: string;
  version: VersionMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function RollbackDialog({
  fileName,
  version,
  open,
  onOpenChange,
  onConfirm,
}: RollbackDialogProps) {
  const formattedDate = new Date(version.created_at).toLocaleString("pt-BR");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Restaurar versao {version.version_num}?</DialogTitle>
          <DialogDescription>
            Voce esta prestes a restaurar <strong>{fileName}</strong> para a versao{" "}
            <strong>{version.version_num}</strong> ({formattedDate}). O estado atual sera salvo
            automaticamente como uma nova versao antes do rollback.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Restaurar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

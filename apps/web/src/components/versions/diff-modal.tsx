import { useQuery } from "@tanstack/react-query";
import { versionDiffQueryOptions, rollbackVersion } from "@/api/versions";
import type { VersionMeta } from "@/api/versions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { RollbackDialog } from "./rollback-dialog";
import { useQueryClient } from "@tanstack/react-query";

interface DiffModalProps {
  agentId: string;
  fileName: string;
  version: VersionMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DiffModal({ agentId, fileName, version, open, onOpenChange }: DiffModalProps) {
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: diff, isLoading } = useQuery({
    ...versionDiffQueryOptions(agentId, fileName, version.version_num),
    enabled: open,
  });

  async function handleRollback() {
    await rollbackVersion(agentId, fileName, version.version_num);
    queryClient.invalidateQueries({ queryKey: ["versions", agentId, fileName] });
    setRollbackOpen(false);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {diff
                ? `v${diff.previousVersionNum ?? 0} → v${diff.versionNum}`
                : `Versao v${version.version_num}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto font-mono text-sm border rounded-md">
            {isLoading && (
              <div className="p-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            )}
            {diff && (
              <table className="w-full border-collapse">
                <tbody>
                  {diff.diff.map((line, i) => (
                    <tr
                      key={i}
                      className={
                        line.type === "added"
                          ? "bg-green-950/40"
                          : line.type === "removed"
                            ? "bg-red-950/40"
                            : ""
                      }
                    >
                      <td className="select-none px-2 py-0.5 text-right text-muted-foreground w-10 border-r border-border text-xs">
                        {line.line}
                      </td>
                      <td className="px-1 py-0.5 select-none w-5 text-center text-xs">
                        {line.type === "added" ? (
                          <span className="text-green-400">+</span>
                        ) : line.type === "removed" ? (
                          <span className="text-red-400">-</span>
                        ) : (
                          <span className="text-muted-foreground"> </span>
                        )}
                      </td>
                      <td
                        className={`px-2 py-0.5 whitespace-pre-wrap break-all ${
                          line.type === "added"
                            ? "text-green-300"
                            : line.type === "removed"
                              ? "text-red-300"
                              : "text-muted-foreground"
                        }`}
                      >
                        {line.content}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            <Button variant="destructive" onClick={() => setRollbackOpen(true)}>
              Restaurar para esta versao
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RollbackDialog
        fileName={fileName}
        version={version}
        open={rollbackOpen}
        onOpenChange={setRollbackOpen}
        onConfirm={handleRollback}
      />
    </>
  );
}

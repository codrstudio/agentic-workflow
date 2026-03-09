import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fileVersionsQueryOptions,
  versionContentQueryOptions,
  rollbackVersion,
} from "@/api/versions";
import type { VersionMeta } from "@/api/versions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DiffModal } from "./diff-modal";
import { RollbackDialog } from "./rollback-dialog";

const FILE_OPTIONS = ["SOUL.md", "AGENT.md", "HEARTBEAT.md", "CONVERSATION.md"];

interface VersionsTabProps {
  agentId: string;
}

export function VersionsTab({ agentId }: VersionsTabProps) {
  const [selectedFile, setSelectedFile] = useState(FILE_OPTIONS[0]!);
  const [contentVersion, setContentVersion] = useState<VersionMeta | null>(null);
  const [diffVersion, setDiffVersion] = useState<VersionMeta | null>(null);
  const [rollbackVersion_, setRollbackVersion] = useState<VersionMeta | null>(null);
  const queryClient = useQueryClient();

  const { data: versions, isLoading } = useQuery(fileVersionsQueryOptions(agentId, selectedFile));

  const sortedVersions = versions ? [...versions].sort((a, b) => b.version_num - a.version_num) : [];
  const latestNum = sortedVersions[0]?.version_num;

  async function handleRollback() {
    if (!rollbackVersion_) return;
    await rollbackVersion(agentId, selectedFile, rollbackVersion_.version_num);
    queryClient.invalidateQueries({ queryKey: ["versions", agentId, selectedFile] });
    setRollbackVersion(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Arquivo</label>
        <Select value={selectedFile} onValueChange={(v) => v && setSelectedFile(v)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILE_OPTIONS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && sortedVersions.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhuma versao encontrada para {selectedFile}.</p>
      )}

      {sortedVersions.length > 0 && (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-2 font-medium">Versao</th>
                <th className="text-left px-4 py-2 font-medium">Data</th>
                <th className="text-left px-4 py-2 font-medium">Autor</th>
                <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Tamanho</th>
                <th className="text-left px-4 py-2 font-medium hidden lg:table-cell">Nota</th>
                <th className="text-right px-4 py-2 font-medium">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {sortedVersions.map((v) => (
                <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">v{v.version_num}</span>
                      {v.version_num === latestNum && (
                        <Badge variant="default" className="text-xs py-0">
                          Atual
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">
                    {v.created_by ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground hidden md:table-cell">
                    {v.size_bytes != null ? `${v.size_bytes} B` : "—"}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground hidden lg:table-cell max-w-xs truncate">
                    {v.change_note ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setContentVersion(v)}
                      >
                        Ver conteudo
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDiffVersion(v)}
                      >
                        Ver diff
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={v.version_num === latestNum}
                        onClick={() => setRollbackVersion(v)}
                      >
                        Restaurar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Content viewer */}
      {contentVersion && (
        <ContentModal
          agentId={agentId}
          fileName={selectedFile}
          version={contentVersion}
          open
          onOpenChange={(open) => { if (!open) setContentVersion(null); }}
        />
      )}

      {/* Diff modal */}
      {diffVersion && (
        <DiffModal
          agentId={agentId}
          fileName={selectedFile}
          version={diffVersion}
          open
          onOpenChange={(open) => { if (!open) setDiffVersion(null); }}
        />
      )}

      {/* Rollback dialog */}
      {rollbackVersion_ && (
        <RollbackDialog
          fileName={selectedFile}
          version={rollbackVersion_}
          open
          onOpenChange={(open) => { if (!open) setRollbackVersion(null); }}
          onConfirm={handleRollback}
        />
      )}
    </div>
  );
}

function ContentModal({
  agentId,
  fileName,
  version,
  open,
  onOpenChange,
}: {
  agentId: string;
  fileName: string;
  version: VersionMeta;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useQuery({
    ...versionContentQueryOptions(agentId, fileName, version.version_num),
    enabled: open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {fileName} — v{version.version_num}
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {isLoading && <Skeleton className="h-64 w-full" />}
          {data && (
            <pre className="whitespace-pre-wrap font-mono text-sm p-4 border rounded-md bg-muted/30">
              {data.content}
            </pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

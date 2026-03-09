import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Upload,
  Trash2,
  Eye,
  Layers,
  HardDrive,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import {
  knowledgeDocsQueryOptions,
  deleteKnowledgeDoc,
} from "@/api/knowledge";
import type { KnowledgeDoc } from "@/api/knowledge";
import { KnowledgeUploadDialog } from "./knowledge-upload-dialog";
import { KnowledgeDocDrawer } from "./knowledge-doc-drawer";

interface KnowledgeTabProps {
  agentId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusBadge(doc: KnowledgeDoc) {
  switch (doc.status) {
    case "indexed":
      return <Badge variant="default">Indexado</Badge>;
    case "processing":
      return <Badge variant="secondary">Processando...</Badge>;
    case "error":
      return <Badge variant="destructive">Erro</Badge>;
    default:
      return <Badge variant="outline">{doc.status}</Badge>;
  }
}

export function KnowledgeTab({ agentId }: KnowledgeTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(knowledgeDocsQueryOptions(agentId));
  const [uploadOpen, setUploadOpen] = useState(false);
  const [drawerState, setDrawerState] = useState<{
    open: boolean;
    docId: number;
  }>({ open: false, docId: 0 });

  const deleteMutation = useMutation({
    mutationFn: (docId: number) => deleteKnowledgeDoc(agentId, docId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
      toast.success("Documento excluido");
    },
    onError: () => {
      toast.error("Erro ao excluir documento");
    },
  });

  const docs = data?.docs ?? [];

  return (
    <div className="space-y-6">
      {/* Header with upload button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Knowledge Base</h3>
          <p className="text-xs text-muted-foreground">
            Documentos indexados para consulta pelo agente
          </p>
        </div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>
          <Upload className="size-4 mr-1.5" />
          Enviar documento
        </Button>
      </div>

      {/* Summary cards */}
      {!isLoading && docs.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documentos</CardTitle>
              <FileText className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{docs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Chunks
              </CardTitle>
              <Layers className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {docs.reduce((sum, d) => sum + d.chunks, 0)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Document list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState
              icon={<BookOpen />}
              title="Nenhum documento"
              description="Envie documentos PDF, TXT ou MD para alimentar a knowledge base do agente."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="size-4 mr-1.5" />
                  Enviar documento
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Chunks</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docs.map((doc) => (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="size-4 shrink-0 text-muted-foreground" />
                            <span className="truncate max-w-[200px]">
                              {doc.filename}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatSize(doc.sizeBytes)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.chunks}
                        </TableCell>
                        <TableCell>{statusBadge(doc)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(doc.createdAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() =>
                                setDrawerState({
                                  open: true,
                                  docId: doc.id,
                                })
                              }
                            >
                              <Eye className="size-4" />
                            </Button>
                            <ConfirmDialog
                              title="Excluir documento"
                              description={`O documento "${doc.filename}" sera removido permanentemente, incluindo seus chunks e embeddings.`}
                              onConfirm={() => deleteMutation.mutate(doc.id)}
                              destructive
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </ConfirmDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {docs.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="flex items-center gap-3 p-4">
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>
                        <HardDrive className="inline size-3 mr-0.5" />
                        {formatSize(doc.sizeBytes)}
                      </span>
                      <span>
                        <Layers className="inline size-3 mr-0.5" />
                        {doc.chunks} chunks
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      {statusBadge(doc)}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(doc.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() =>
                        setDrawerState({ open: true, docId: doc.id })
                      }
                    >
                      <Eye className="size-4" />
                    </Button>
                    <ConfirmDialog
                      title="Excluir documento"
                      description={`O documento "${doc.filename}" sera removido permanentemente.`}
                      onConfirm={() => deleteMutation.mutate(doc.id)}
                      destructive
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </ConfirmDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Footer hint */}
      {docs.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Documentos sao automaticamente indexados e ficam disponiveis para o
          agente consultar nas conversas.
        </p>
      )}

      {/* Upload dialog */}
      <KnowledgeUploadDialog
        agentId={agentId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
      />

      {/* Doc detail drawer */}
      <KnowledgeDocDrawer
        agentId={agentId}
        docId={drawerState.docId}
        open={drawerState.open}
        onClose={() => setDrawerState((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}

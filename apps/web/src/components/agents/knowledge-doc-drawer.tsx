import { useQuery } from "@tanstack/react-query";
import { FileText, Layers, Calendar, HardDrive, AlertCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { knowledgeDocQueryOptions } from "@/api/knowledge";
import type { KnowledgeDoc } from "@/api/knowledge";
import { useIsMobile } from "@/hooks/use-mobile";

interface KnowledgeDocDrawerProps {
  agentId: string;
  docId: number;
  open: boolean;
  onClose: () => void;
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
    hour: "2-digit",
    minute: "2-digit",
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

export function KnowledgeDocDrawer({
  agentId,
  docId,
  open,
  onClose,
}: KnowledgeDocDrawerProps) {
  const isMobile = useIsMobile();
  const { data: doc, isLoading } = useQuery({
    ...knowledgeDocQueryOptions(agentId, docId),
    enabled: open && docId > 0,
  });

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "flex h-[85dvh] flex-col"
            : "flex w-full flex-col sm:max-w-md"
        }
      >
        <SheetHeader className="border-b pb-4">
          <SheetTitle>Detalhes do documento</SheetTitle>
          <SheetDescription className="sr-only">
            Informacoes detalhadas do documento de knowledge base
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-auto p-4 pt-2">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-36" />
            </div>
          )}
          {doc && (
            <>
              <div className="flex items-start gap-3">
                <FileText className="size-8 shrink-0 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <h3 className="text-base font-medium break-all">
                    {doc.filename}
                  </h3>
                  <p className="text-sm text-muted-foreground">{doc.slug}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <DetailRow
                  icon={<HardDrive className="size-4" />}
                  label="Tamanho"
                  value={formatSize(doc.sizeBytes)}
                />
                <DetailRow
                  icon={<Layers className="size-4" />}
                  label="Chunks"
                  value={String(doc.chunks)}
                />
                <DetailRow
                  icon={<Calendar className="size-4" />}
                  label="Enviado em"
                  value={formatDate(doc.createdAt)}
                />
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center text-muted-foreground">
                    <FileText className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Tipo</p>
                    <p className="text-sm">{doc.contentType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <div className="mt-0.5">{statusBadge(doc)}</div>
                  </div>
                </div>
              </div>

              {doc.status === "error" && doc.error && (
                <div className="flex gap-2 rounded-md border border-destructive/50 bg-destructive/5 p-3">
                  <AlertCircle className="size-4 shrink-0 text-destructive mt-0.5" />
                  <p className="text-sm text-destructive">{doc.error}</p>
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Documentos sao automaticamente indexados e ficam disponiveis
                para o agente consultar nas conversas.
              </p>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { uploadKnowledgeDoc } from "@/api/knowledge";

interface KnowledgeUploadDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ACCEPT = ".pdf,.txt,.md";
const MAX_SIZE = 10 * 1024 * 1024;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgeUploadDialog({
  agentId,
  open,
  onOpenChange,
}: KnowledgeUploadDialogProps) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: (f: File) => uploadKnowledgeDoc(agentId, f),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", agentId] });
      toast.success("Documento enviado com sucesso");
      setFile(null);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao enviar documento");
    },
  });

  function validateFile(f: File): string | null {
    if (f.size > MAX_SIZE) return `Arquivo excede o limite de ${formatSize(MAX_SIZE)}`;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["pdf", "txt", "md"].includes(ext))
      return "Tipo de arquivo nao suportado. Use PDF, TXT ou MD.";
    return null;
  }

  function handleFileSelect(f: File) {
    const error = validateFile(f);
    if (error) {
      toast.error(error);
      return;
    }
    setFile(f);
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFileSelect(f);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFileSelect(f);
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleSubmit() {
    if (!file) return;
    uploadMutation.mutate(file);
  }

  function handleClose(v: boolean) {
    if (uploadMutation.isPending) return;
    if (!v) {
      setFile(null);
      setDragOver(false);
    }
    onOpenChange(v);
  }

  const progress = uploadMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar documento</DialogTitle>
          <DialogDescription>
            Arraste um arquivo ou clique para selecionar. PDF, TXT ou MD ate{" "}
            {formatSize(MAX_SIZE)}.
          </DialogDescription>
        </DialogHeader>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          <Upload className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Arraste e solte aqui ou clique para selecionar
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>

        {/* File preview */}
        {file && (
          <div className="flex items-center gap-3 rounded-md border p-3">
            <FileText className="size-5 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatSize(file.size)}
              </p>
            </div>
            {!progress && (
              <Button
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        )}

        {/* Progress bar */}
        {progress && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full animate-pulse rounded-full bg-primary" style={{ width: "100%" }} />
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={progress}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!file || progress}>
            {progress ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { Download, File, FileText } from "@phosphor-icons/react"
import type { Attachment } from "@/lib/hooks/use-attachments"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function DocTypeIcon({ fileType }: { fileType: string }) {
  if (fileType === "application/pdf")
    return <FileText className="size-5 text-red-500 shrink-0" />
  if (
    fileType === "application/vnd.ms-excel" ||
    fileType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    fileType === "text/csv"
  )
    return <FileText className="size-5 text-green-600 shrink-0" />
  return <File className="size-5 text-blue-500 shrink-0" />
}

function ImageCard({ attachment }: { attachment: Attachment }) {
  const src = `/api/v1/chat/attachments/${attachment.id}/download`
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="block overflow-hidden rounded-md border border-border hover:ring-2 hover:ring-ring transition-all"
            aria-label={`Ver imagem ${attachment.fileName}`}
          >
            <img
              src={src}
              alt={attachment.fileName}
              className="max-w-[300px] max-h-[200px] w-full object-cover"
              loading="lazy"
            />
          </a>
        </TooltipTrigger>
        <TooltipContent>{attachment.fileName}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function DocCard({ attachment }: { attachment: Attachment }) {
  const href = `/api/v1/chat/attachments/${attachment.id}/download`
  return (
    <a
      href={href}
      download={attachment.fileName}
      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 hover:bg-accent transition-colors group"
      aria-label={`Baixar ${attachment.fileName}`}
    >
      <DocTypeIcon fileType={attachment.fileType} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
      </div>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Download className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
          </TooltipTrigger>
          <TooltipContent>Baixar arquivo</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </a>
  )
}

interface AttachmentPreviewProps {
  attachments: Attachment[]
}

export function AttachmentPreview({ attachments }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null

  const images = attachments.filter((a) => a.fileType.startsWith("image/"))
  const docs = attachments.filter((a) => !a.fileType.startsWith("image/"))

  return (
    <div className="flex flex-col gap-2 mt-2">
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((a) => (
            <ImageCard key={a.id} attachment={a} />
          ))}
        </div>
      )}
      {docs.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {docs.map((a) => (
            <DocCard key={a.id} attachment={a} />
          ))}
        </div>
      )}
    </div>
  )
}

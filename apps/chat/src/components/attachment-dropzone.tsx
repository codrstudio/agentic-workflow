import { useRef } from "react"
import type { DragEvent, ChangeEvent } from "react"
import { File, FileText, Image, Paperclip, X } from "@phosphor-icons/react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

const MAX_FILE_SIZE = 10 * 1024 * 1024

const ACCEPTED_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".csv", ".txt",
])

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain",
])

function getExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".")
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ""
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE) return `${file.name}: arquivo excede 10MB`
  const ext = getExtension(file.name)
  if (!ACCEPTED_EXTENSIONS.has(ext)) return `${file.name}: tipo não aceito (${ext})`
  if (file.type && !ACCEPTED_MIME_TYPES.has(file.type))
    return `${file.name}: MIME type não aceito`
  return null
}

function FileIcon({ fileType }: { fileType: string }) {
  if (fileType.startsWith("image/")) return <Image className="size-4 text-blue-500" />
  if (fileType === "application/pdf") return <FileText className="size-4 text-red-500" />
  return <File className="size-4 text-muted-foreground" />
}

export interface PendingFile {
  file: File
  id: string
}

interface AttachmentDropzoneProps {
  files: PendingFile[]
  errors: string[]
  onAdd: (files: PendingFile[], errors: string[]) => void
  onRemove: (id: string) => void
  onDragOver?: (over: boolean) => void
  disabled?: boolean
}

export function AttachmentDropzone({
  files,
  errors,
  onAdd,
  onRemove,
  onDragOver,
  disabled = false,
}: AttachmentDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function processFiles(rawFiles: FileList | File[]) {
    const newPending: PendingFile[] = []
    const newErrors: string[] = []
    for (const file of Array.from(rawFiles)) {
      const err = validateFile(file)
      if (err) {
        newErrors.push(err)
      } else {
        newPending.push({ file, id: `${Date.now()}-${Math.random()}` })
      }
    }
    onAdd(newPending, newErrors)
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      processFiles(e.target.files)
      e.target.value = ""
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    onDragOver?.(false)
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    onDragOver?.(true)
  }

  function handleDragLeave() {
    onDragOver?.(false)
  }

  return (
    <div onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
      {/* Error messages */}
      {errors.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {errors.map((err, i) => (
            <p key={i} className="text-xs text-destructive">
              {err}
            </p>
          ))}
        </div>
      )}

      {/* Pending files preview */}
      {files.length > 0 && (
        <div className="mb-2 flex flex-col gap-1">
          {files.map((pf) => (
            <div
              key={pf.id}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5"
            >
              <FileIcon fileType={pf.file.type} />
              <span className="flex-1 min-w-0 text-xs truncate">{pf.file.name}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatFileSize(pf.file.size)}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onRemove(pf.id)}
                      className="inline-flex items-center justify-center size-5 rounded text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label={`Remover ${pf.file.name}`}
                    >
                      <X className="size-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Remover arquivo</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          ))}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
        aria-label="Selecionar arquivos para anexar"
      />

      {/* Paperclip button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Anexar arquivo"
            >
              <Paperclip className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Anexar arquivo (máx. 10MB)</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}

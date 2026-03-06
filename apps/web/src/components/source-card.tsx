import { FileText, Link as LinkIcon, Code, FileType2, File } from "lucide-react";
import type { Source } from "@/hooks/use-sources";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const typeIcons: Record<Source["type"], LucideIcon> = {
  markdown: FileText,
  text: File,
  pdf: FileType2,
  url: LinkIcon,
  code: Code,
};

const typeLabels: Record<Source["type"], string> = {
  markdown: "Markdown",
  text: "Text",
  pdf: "PDF",
  url: "URL",
  code: "Code",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface SourceCardProps {
  source: Source;
  className?: string;
  onClick?: (source: Source) => void;
}

export function SourceCard({ source, className, onClick }: SourceCardProps) {
  const Icon = typeIcons[source.type];
  const preview = source.content
    ? source.content.slice(0, 120).replace(/\n/g, " ")
    : source.file_path
      ? `File: ${source.file_path}`
      : "";

  return (
    <button
      type="button"
      onClick={() => onClick?.(source)}
      className={cn(
        "group flex flex-col gap-2.5 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {/* Header: icon + name + type label */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4.5 w-4.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary transition-colors">
            {source.name}
          </h3>
          <span className="text-xs text-muted-foreground">
            {typeLabels[source.type]}
          </span>
        </div>
      </div>

      {/* Preview 2 lines */}
      {preview && (
        <p className="text-sm text-muted-foreground line-clamp-2">
          {preview}
        </p>
      )}

      {/* Tags */}
      {source.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {source.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Date */}
      <div className="mt-auto text-xs text-muted-foreground">
        {formatDate(source.updated_at)}
      </div>
    </button>
  );
}

export function SourceCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-1">
        <Skeleton className="h-4 w-12 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-3 w-20 mt-auto" />
    </div>
  );
}

export function SourceGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <SourceCardSkeleton key={i} />
      ))}
    </div>
  );
}

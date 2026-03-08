import { FileText, Link as LinkIcon, Code, FileType2, File, Network, Pin, MoreVertical, Settings2 } from "lucide-react";
import type { Source } from "@/hooks/use-sources";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryBadge } from "@/components/category-badge";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

const typeIcons: Record<Source["type"], LucideIcon> = {
  markdown: FileText,
  text: File,
  pdf: FileType2,
  url: LinkIcon,
  code: Code,
  codebase_graph: Network,
};

const typeLabels: Record<Source["type"], string> = {
  markdown: "Markdown",
  text: "Text",
  pdf: "PDF",
  url: "URL",
  code: "Code",
  codebase_graph: "Codebase Graph",
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
  onConfigureContext?: (source: Source) => void;
}

export function SourceCard({ source, className, onClick, onConfigureContext }: SourceCardProps) {
  const Icon = typeIcons[source.type];
  const preview = source.content
    ? source.content.slice(0, 120).replace(/\n/g, " ")
    : source.file_path
      ? `File: ${source.file_path}`
      : "";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {/* Menu '...' button */}
      {onConfigureContext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onConfigureContext(source);
          }}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
          aria-label="Configurar contexto"
          title="Configurar contexto"
        >
          <MoreVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Clickable area */}
      <button
        type="button"
        onClick={() => onClick?.(source)}
        className="flex flex-col gap-2.5 text-left"
      >
        {/* Header: icon + name + type label + pin + category */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4.5 w-4.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary transition-colors">
                {source.name}
              </h3>
              {source.pinned && (
                <Pin className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Pinned" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">
                {typeLabels[source.type]}
              </span>
              <CategoryBadge category={source.category} />
            </div>
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
    </div>
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

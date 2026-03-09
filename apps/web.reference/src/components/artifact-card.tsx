import {
  FileText,
  Code,
  Braces,
  GitFork,
  Settings,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Artifact, ArtifactType, ArtifactOrigin } from "@/hooks/use-artifacts";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArtifactAttributionBadge } from "@/components/artifact-attribution-badge";

const typeIcons: Record<ArtifactType, LucideIcon> = {
  document: FileText,
  code: Code,
  json: Braces,
  diagram: GitFork,
  config: Settings,
};

const typeLabels: Record<ArtifactType, string> = {
  document: "Document",
  code: "Code",
  json: "JSON",
  diagram: "Diagram",
  config: "Config",
};

const originLabels: Record<ArtifactOrigin, string> = {
  chat: "Chat",
  harness: "Harness",
  manual: "Manual",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface ArtifactCardProps {
  artifact: Artifact;
  projectSlug?: string;
  className?: string;
  onClick?: (artifact: Artifact) => void;
}

export function ArtifactCard({ artifact, projectSlug, className, onClick }: ArtifactCardProps) {
  const Icon = typeIcons[artifact.type];
  const preview = artifact.content
    ? artifact.content.slice(0, 120).replace(/\n/g, " ")
    : "";

  return (
    <button
      type="button"
      onClick={() => onClick?.(artifact)}
      className={cn(
        "group flex flex-col gap-2.5 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      {/* Header: icon + name */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="h-4.5 w-4.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-card-foreground group-hover:text-primary transition-colors">
            {artifact.name}
          </h3>
          {/* Badges: type, origin, version */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {typeLabels[artifact.type]}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {originLabels[artifact.origin]}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              v{artifact.version}
            </Badge>
            {projectSlug && artifact.origin === "harness" && (
              <ArtifactAttributionBadge
                projectSlug={projectSlug}
                artifactId={artifact.id}
              />
            )}
          </div>
        </div>
      </div>

      {/* Preview 2 lines */}
      {preview && (
        <p className="text-sm text-muted-foreground line-clamp-2">{preview}</p>
      )}

      {/* Tags */}
      {artifact.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {artifact.tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="text-[10px] px-1.5 py-0"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Date */}
      <div className="mt-auto text-xs text-muted-foreground">
        {formatDate(artifact.updated_at)}
      </div>
    </button>
  );
}

export function ArtifactCardSkeleton() {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-1">
            <Skeleton className="h-4 w-14 rounded-full" />
            <Skeleton className="h-4 w-12 rounded-full" />
            <Skeleton className="h-4 w-8 rounded-full" />
          </div>
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

export function ArtifactGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <ArtifactCardSkeleton key={i} />
      ))}
    </div>
  );
}
